/* =========================================================================
   Guided tour
   ---------------------------------------------------------------------------
   A small, dependency-free spotlight-and-tooltip walkthrough. Each step names
   a CSS selector to highlight and an optional async `before()` hook that runs
   first (e.g. switch the console to the right view) — the tour waits for the
   target element to actually exist in the DOM before positioning itself,
   since every step may trigger a full re-paint.
   ========================================================================= */

import { el, clear, icon, I18n, L } from './core.js';

let host = null;
let steps = [];
let index = 0;
let active = false;

async function waitFor(selector, { timeout = 2000, interval = 50 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const node = document.querySelector(selector);
    if (node) return node;
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}

/**
 * Positions relative to the viewport, not the document: `.tour-host` is
 * `position: fixed; inset: 0`, which makes it the containing block for its
 * absolutely-positioned children — so their coordinates must NOT add
 * `window.scrollX/Y`, even though the target's own rect was measured after
 * scrolling it into view.
 */
function place(tooltip, target) {
  const r = target.getBoundingClientRect();
  const tw = tooltip.offsetWidth || 320;
  const th = tooltip.offsetHeight || 140;
  const margin = 14;
  let top = r.bottom + margin;
  const left = Math.min(Math.max(r.left, margin), window.innerWidth - tw - margin);
  if (top + th > window.innerHeight - margin) top = Math.max(margin, r.top - th - margin);
  tooltip.style.top = `${Math.min(Math.max(margin, top), window.innerHeight - th - margin)}px`;
  tooltip.style.left = `${left}px`;
}

async function renderStep() {
  const step = steps[index];
  if (!step) { end(); return; }
  clear(host);
  const en = I18n.lang === 'en';

  if (step.before) { try { await step.before(); } catch { /* best effort */ } }
  const target = step.selector ? await waitFor(step.selector) : null;

  const scrim = el('div.tour-scrim');
  host.append(scrim);

  let spot = null;
  if (target) {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise((r) => setTimeout(r, 220));
    const r = target.getBoundingClientRect();
    spot = el('div.tour-spot', {
      style: {
        top: `${r.top - 6}px`, left: `${r.left - 6}px`,
        width: `${r.width + 12}px`, height: `${r.height + 12}px`,
      },
    });
    host.append(spot);
  }

  const tooltip = el('div.tour-tip.card.card-solid.card-pad',
    el('div.row.between.gap-3',
      el('span.badge', { text: `${index + 1} / ${steps.length}` }),
      el('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': en ? 'Close tour' : 'Cerrar recorrido', onclick: end }, icon('x'))),
    el('h3', { text: L(step.title) }),
    el('p.text-muted', { text: L(step.body) }),
    el('div.row.between.gap-2', { style: { marginTop: 'var(--sp-4)' } },
      index > 0
        ? el('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: prev }, icon('arrowLeft'), el('span', { text: en ? 'Back' : 'Atrás' }))
        : el('span'),
      index < steps.length - 1
        ? el('button.btn.btn-primary.btn-sm', { type: 'button', onclick: next }, el('span', { text: en ? 'Next' : 'Siguiente' }), icon('arrowRight'))
        : el('button.btn.btn-primary.btn-sm', { type: 'button', onclick: end }, icon('check'), el('span', { text: en ? 'Finish' : 'Terminar' }))));

  host.append(tooltip);
  if (target) place(tooltip, target);
  else { tooltip.style.top = '50%'; tooltip.style.left = '50%'; tooltip.style.transform = 'translate(-50%,-50%)'; }
}

function next() { if (index < steps.length - 1) { index++; renderStep(); } }
function prev() { if (index > 0) { index--; renderStep(); } }

export function start(tourSteps, mount = document.body) {
  if (!tourSteps?.length) return;
  steps = tourSteps;
  index = 0;
  active = true;
  host = el('div.tour-host', { role: 'dialog', 'aria-label': 'Guided tour' });
  mount.append(host);
  renderStep();
}

export function end() {
  active = false;
  host?.remove();
  host = null;
  steps = [];
  index = 0;
}

export const isActive = () => active;
