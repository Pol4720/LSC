/* =========================================================================
   LSC · Dashboard charts — hand-rolled inline SVG, zero dependencies
   ---------------------------------------------------------------------------
   Every chart here plots a SINGLE series (magnitude by category, or a count
   over time), so identity never rides on colour: one recessive hue, direct
   value labels on the marks, and a table fallback for screen readers.
   Marks follow the house spec: 4px rounded data-ends, 2px surface gaps,
   2px lines, ≥8px hit targets, recessive axes.
   ========================================================================= */

import { el, fmtNumber, I18n } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    n.setAttribute(k, String(v));
  }
  for (const k of kids.flat()) if (k) n.append(k);
  return n;
};

/**
 * Horizontal bar chart for magnitude-by-category.
 * @param {Array<{label:string, value:number, hint?:string}>} rows
 */
export function barChart(rows, { height = 26, gap = 8, valueFormat } = {}) {
  const host = el('div.chart.chart-bars');
  if (!rows.length) return host.append(emptyNote()), host;

  const max = Math.max(1, ...rows.map((r) => r.value));
  const fmt = valueFormat || ((v) => fmtNumber(v, I18n.lang));

  for (const r of rows) {
    const pct = (r.value / max) * 100;
    const row = el('div.bar-row', { title: r.hint || `${r.label}: ${fmt(r.value)}` },
      el('span.bar-label', { text: r.label }),
      el('span.bar-track',
        el('span.bar-fill', { style: { width: `${Math.max(r.value > 0 ? 2 : 0, pct)}%` } })),
      el('span.bar-value', { text: fmt(r.value) }),
    );
    row.style.setProperty('--bar-h', `${height}px`);
    row.style.setProperty('--bar-gap', `${gap}px`);
    host.append(row);
  }
  host.append(srTable(rows, fmt));
  return host;
}

/**
 * Area + line over time with a hover crosshair.
 * @param {Array<{t:string, value:number}>} points  chronological
 */
export function areaChart(points, { height = 132, label = '' } = {}) {
  const host = el('div.chart.chart-area');
  if (points.length < 2) return host.append(emptyNote()), host;

  const W = 640, H = height, PAD_T = 12, PAD_B = 22, PAD_L = 4, PAD_R = 4;
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const x = (i) => PAD_L + (i / (points.length - 1)) * innerW;
  const y = (v) => PAD_T + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`;

  const gradId = `g-${Math.random().toString(36).slice(2, 8)}`;
  const marker = svgEl('circle', { r: 4.5, class: 'spark-dot', opacity: 0 });
  const crosshair = svgEl('line', { class: 'spark-cross', y1: PAD_T, y2: PAD_T + innerH, opacity: 0 });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'spark', role: 'img',
    'aria-label': label || 'timeline',
    preserveAspectRatio: 'none',
  },
    svgEl('defs', svgEl('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 },
      svgEl('stop', { offset: '0%', 'stop-color': 'var(--brand)', 'stop-opacity': 0.34 }),
      svgEl('stop', { offset: '100%', 'stop-color': 'var(--brand)', 'stop-opacity': 0.02 }))),
    svgEl('line', { class: 'spark-base', x1: PAD_L, x2: W - PAD_R, y1: PAD_T + innerH, y2: PAD_T + innerH }),
    svgEl('path', { d: area, fill: `url(#${gradId})` }),
    svgEl('path', { d: line, class: 'spark-line' }),
    crosshair, marker,
  );

  const tip = el('div.chart-tip', { role: 'status' });
  const box = el('div.spark-wrap', svg, tip);

  const onMove = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left) / rect.width;
    const i = Math.round(Math.max(0, Math.min(1, px)) * (points.length - 1));
    const p = points[i];
    marker.setAttribute('cx', x(i)); marker.setAttribute('cy', y(p.value)); marker.setAttribute('opacity', 1);
    crosshair.setAttribute('x1', x(i)); crosshair.setAttribute('x2', x(i)); crosshair.setAttribute('opacity', 1);
    tip.textContent = `${p.t} · ${fmtNumber(p.value, I18n.lang)}`;
    tip.style.left = `${(i / (points.length - 1)) * 100}%`;
    tip.classList.add('on');
  };
  const onLeave = () => {
    marker.setAttribute('opacity', 0);
    crosshair.setAttribute('opacity', 0);
    tip.classList.remove('on');
  };
  box.addEventListener('mousemove', onMove);
  box.addEventListener('touchmove', onMove, { passive: true });
  box.addEventListener('mouseleave', onLeave);
  box.addEventListener('touchend', onLeave);

  host.append(box);
  host.append(el('div.row.between.text-xs.text-subtle',
    el('span', { text: points[0].t }),
    el('span', { text: points[points.length - 1].t })));
  host.append(srTable(points.map((p) => ({ label: p.t, value: p.value })), (v) => fmtNumber(v, I18n.lang)));
  return host;
}

/** Big single number with an optional trend caption. */
export function statTile({ label, value, hint, tone = '' }) {
  return el(`div.stat-tile${tone ? '.tone-' + tone : ''}`,
    el('span.stat-label', { text: label }),
    el('span.stat-value', { text: value }),
    hint ? el('span.stat-hint', { text: hint }) : null,
  );
}

/* ---------------------------------------------------------------- utils -- */
function emptyNote() {
  return el('p.text-sm.text-subtle', {
    text: I18n.lang === 'en' ? 'Not enough data yet.' : 'Aún no hay datos suficientes.',
  });
}

/** Screen-reader / print table so the data is never colour- or shape-only. */
function srTable(rows, fmt) {
  const table = el('table.sr-only');
  const tbody = el('tbody');
  for (const r of rows) {
    tbody.append(el('tr', el('th', { scope: 'row', text: r.label }), el('td', { text: fmt(r.value) })));
  }
  table.append(tbody);
  return table;
}

/** Weekly buckets for the last `weeks` weeks. */
export function weeklySeries(dates, weeks = 12) {
  const now = new Date();
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * 86400000);
    const start = new Date(end.getTime() - 7 * 86400000);
    const count = dates.filter((d) => {
      const t = new Date(d).getTime();
      return t > start.getTime() && t <= end.getTime();
    }).length;
    out.push({
      t: `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`,
      value: count,
    });
  }
  return out;
}
