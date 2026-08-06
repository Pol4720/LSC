/* =========================================================================
   LSC · Answer summarisation (pure)
   ---------------------------------------------------------------------------
   Turns the raw answer object into human-readable groups. Shared by the review
   step, the advisor console detail view and every export format, so a client
   sees exactly the same wording the advisor does.
   ========================================================================= */

import { deepGet, isEmpty, fmtNumber, fmtDate } from './core.js';
import { STEPS, visibleFields } from './schema.js';
import { byId, parseLotUrl, BODY_TYPES } from './catalogs.js';

const pick = (v, lang) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return v[lang] ?? v.es ?? v.en ?? '';
};

/** Human-readable rendering of one field's value. */
export function formatValue(field, value, lang = 'es') {
  if (isEmpty(value) && value !== 0 && value !== false) return null;

  switch (field.type) {
    case 'switch':
      return value === true ? (lang === 'en' ? 'Yes' : 'Sí') : (lang === 'en' ? 'No' : 'No');

    case 'radio':
    case 'segmented':
    case 'select': {
      const o = byId(field.options || [], value);
      return o ? `${o.emoji ? o.emoji + ' ' : ''}${pick(o.label, lang)}` : String(value);
    }

    case 'multi':
    case 'chips':
    case 'priority': {
      const arr = Array.isArray(value) ? value : [value];
      return arr.map((id) => {
        const o = byId(field.options || [], id);
        return o ? `${o.emoji ? o.emoji + ' ' : ''}${pick(o.label, lang)}` : id;
      }).join(' · ');
    }

    case 'tags':
      return (Array.isArray(value) ? value : []).join(' · ');

    case 'money':
      return `$${fmtNumber(value, lang)}`;

    case 'slider':
      return field.format
        ? field.format(value, lang)
        : `${fmtNumber(value, lang)}${field.unit ? ' ' + field.unit : ''}`;

    case 'yearrange':
      return value?.from && value?.to ? `${value.from} – ${value.to}` : null;

    case 'date':
      return fmtDate(value, lang);

    case 'repeater': {
      const rows = Array.isArray(value) ? value : [];
      if (!rows.length) return null;
      return rows.map((r) => {
        const parsed = r.url ? parseLotUrl(r.url) : null;
        const src = parsed?.source ? `[${parsed.source}${parsed.lot ? ' #' + parsed.lot : ''}] ` : '';
        return `${src}${r.url || ''}${r.note ? ` — ${r.note}` : ''}`.trim();
      }).join('\n');
    }

    case 'number':
      return fmtNumber(value, lang);

    default:
      return String(value);
  }
}

/**
 * Build the grouped summary.
 * @returns {Array<{id, title, emoji, icon, items:[{id,label,value,fieldType}]}>}
 */
export function summarize(data, lang = 'es', mode = 'full') {
  const groups = [];
  for (const step of STEPS) {
    if (step.kind === 'intro') continue;
    const items = [];
    for (const field of visibleFields(step, data, mode)) {
      if (field.type === 'info') continue;
      const raw = deepGet(data, field.id);
      const value = formatValue(field, raw, lang);
      if (value === null || value === '') continue;
      items.push({
        id: field.id,
        label: pick(field.label, lang),
        value,
        raw,
        fieldType: field.type,
      });
    }
    if (items.length) {
      groups.push({
        id: step.id,
        title: pick(step.title, lang),
        emoji: step.emoji || '',
        icon: step.icon || 'file',
        items,
      });
    }
  }
  return groups;
}

/** Short one-line description used in lists and cards. */
export function headline(data, lang = 'es') {
  const bodies = (deepGet(data, 'vehicle.bodyTypes') || [])
    .map((id) => pick(byId(BODY_TYPES, id)?.label, lang)).filter(Boolean);
  const makes = deepGet(data, 'vehicle.makes') || [];
  const models = deepGet(data, 'vehicle.models') || [];
  const years = deepGet(data, 'vehicle.years');
  const budget = deepGet(data, 'budget.total');

  const parts = [];
  if (models.length) parts.push(models.slice(0, 2).join(' / '));
  else if (makes.length) parts.push(makes.slice(0, 2).join(' / '));
  if (bodies.length) parts.push(bodies.slice(0, 2).join(' / '));
  if (years?.from && years?.to) parts.push(`${years.from}-${years.to}`);
  const left = parts.join(' · ') || (lang === 'en' ? 'No preference yet' : 'Sin preferencia aún');
  return budget ? `${left} — $${fmtNumber(budget, lang)}` : left;
}

/**
 * Client profile derived signals the advisor uses for triage.
 */
export function deriveProfile(data) {
  const titles = deepGet(data, 'condition.titles') || [];
  const tolerance = deepGet(data, 'condition.damageTolerance');
  const urgency = deepGet(data, 'budget.urgency');
  const budget = Number(deepGet(data, 'budget.total')) || 0;
  const experience = deepGet(data, 'goal.experience');
  const useCases = deepGet(data, 'goal.useCases') || [];

  const riskScore =
    (titles.includes('nonrepairable') ? 4 : 0) +
    (titles.includes('billofsale') ? 3 : 0) +
    (titles.includes('salvage') ? 2 : 0) +
    (titles.includes('rebuilt') ? 1 : 0) +
    ({ none: 0, cosmetic: 1, moderate: 2, heavy: 3 }[tolerance] ?? 0);

  const urgencyScore = { asap: 4, '2weeks': 3, month: 2, quarter: 1, browsing: 0 }[urgency] ?? 1;

  return {
    riskAppetite: riskScore >= 5 ? 'high' : riskScore >= 2 ? 'medium' : 'low',
    riskScore,
    urgencyScore,
    budget,
    budgetBand: budget >= 25000 ? 'premium' : budget >= 12000 ? 'mid' : budget >= 5000 ? 'entry' : 'budget',
    experience: experience || 'none',
    needsEducation: experience === 'none' || tolerance === 'none',
    isExport: useCases.includes('export') || deepGet(data, 'logistics.finalDestination') === 'export',
    isResale: useCases.includes('resale'),
    isRideshare: useCases.includes('rideshare'),
    /** Simple lead temperature: budget + urgency + completeness of intent. */
    heat: Math.min(100, Math.round(urgencyScore * 15 + Math.min(40, budget / 500) + (titles.length ? 10 : 0))),
  };
}

/** Plain-text brief the advisor can paste into WhatsApp. */
export function toPlainText(record, lang = 'es') {
  const data = record.data || record;
  const groups = summarize(data, lang);
  const L = lang === 'en';
  const lines = [
    `${L ? 'CLIENT REQUEST' : 'SOLICITUD DE CLIENTE'} — ${record.id || ''}`,
    `${L ? 'Received' : 'Recibido'}: ${fmtDate(record.createdAt || new Date().toISOString(), lang, { dateStyle: 'medium', timeStyle: 'short' })}`,
    '',
  ];
  for (const g of groups) {
    lines.push(`── ${g.emoji} ${g.title.toUpperCase()} ──`);
    for (const it of g.items) lines.push(`• ${it.label}: ${it.value}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function toMarkdown(record, lang = 'es') {
  const data = record.data || record;
  const groups = summarize(data, lang);
  const L = lang === 'en';
  const out = [
    `# ${L ? 'Client request' : 'Solicitud de cliente'} · \`${record.id || ''}\``,
    '',
    `**${L ? 'Received' : 'Recibido'}:** ${fmtDate(record.createdAt || new Date().toISOString(), lang, { dateStyle: 'full', timeStyle: 'short' })}  `,
    record.meta?.mode ? `**${L ? 'Mode' : 'Modo'}:** ${record.meta.mode}  ` : '',
    '',
  ];
  for (const g of groups) {
    out.push(`## ${g.emoji} ${g.title}`, '', '| | |', '|---|---|');
    for (const it of g.items) out.push(`| **${it.label}** | ${String(it.value).replace(/\n/g, '<br>')} |`);
    out.push('');
  }
  return out.join('\n');
}
