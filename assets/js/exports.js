/* =========================================================================
   LSC · Export formats (pure string builders — unit-testable)
   ---------------------------------------------------------------------------
   CSV · JSON · Markdown · plain text · vCard · iCalendar · printable HTML
   ========================================================================= */

import { deepGet, fmtDate, fmtNumber } from './core.js';
import { allFields } from './schema.js';
import { formatValue, summarize, headline, deriveProfile, toMarkdown, toPlainText } from './summary.js';
import { PIPELINE_STAGES, byId } from './catalogs.js';
import { CONFIG } from './config.js';

/* ----------------------------------------------------------------- CSV --- */
export function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Wide CSV: one row per client, one column per schema field.
 * @param {Array<{id, createdAt, data, crm}>} records
 */
export function toCsv(records, lang = 'es', { delimiter = ',' } = {}) {
  const fields = allFields().filter((f) => f.type !== 'info');
  const header = [
    'id', 'created_at', 'updated_at', 'stage', 'priority', 'tags', 'headline',
    'heat', 'risk_appetite', 'budget_band',
    ...fields.map((f) => f.id),
  ];
  const rows = [header.map(csvEscape).join(delimiter)];

  for (const r of records) {
    const data = r.data || {};
    const crm = r.crm || {};
    const profile = deriveProfile(data);
    const line = [
      r.id,
      r.createdAt || '',
      crm.updatedAt || '',
      crm.stage || 'new',
      crm.priority || '',
      (crm.tags || []).join('|'),
      headline(data, lang),
      profile.heat,
      profile.riskAppetite,
      profile.budgetBand,
      ...fields.map((f) => {
        const raw = deepGet(data, f.id);
        const v = formatValue(f, raw, lang);
        return v === null ? '' : String(v).replace(/\n/g, ' | ');
      }),
    ];
    rows.push(line.map(csvEscape).join(delimiter));
  }
  // BOM keeps Excel happy with accented Spanish text.
  return '﻿' + rows.join('\r\n') + '\r\n';
}

/** Narrow CSV: one row per answered question — friendlier for pivot tables. */
export function toLongCsv(records, lang = 'es') {
  const rows = [['client_id', 'created_at', 'section', 'question', 'answer'].join(',')];
  for (const r of records) {
    for (const g of summarize(r.data || {}, lang)) {
      for (const it of g.items) {
        rows.push([r.id, r.createdAt || '', g.title, it.label, String(it.value).replace(/\n/g, ' | ')]
          .map(csvEscape).join(','));
      }
    }
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

/* ---------------------------------------------------------------- JSON --- */
export function toJson(records) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: records.length,
    records,
  }, null, 2);
}

/* --------------------------------------------------------------- vCard --- */
export function toVCard(record, lang = 'es') {
  const d = record.data || {};
  const name = deepGet(d, 'contact.fullName') || record.id;
  const parts = String(name).trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const first = parts[0] || '';
  const phone = deepGet(d, 'contact.phone') || '';
  const email = deepGet(d, 'contact.email') || '';
  const city = deepGet(d, 'contact.city') || '';
  const stateCode = deepGet(d, 'contact.state') || '';
  const note = `${headline(d, lang)} · ${record.id}`;

  const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(name)}`,
    `ORG:${esc(CONFIG.brandName)}`,
    phone ? `TEL;TYPE=CELL:${esc(phone)}` : '',
    email ? `EMAIL;TYPE=INTERNET:${esc(email)}` : '',
    (city || stateCode) ? `ADR;TYPE=HOME:;;;${esc(city)};${esc(stateCode)};;USA` : '',
    `NOTE:${esc(note)}`,
    `UID:${record.id}`,
    `REV:${new Date().toISOString()}`,
    'END:VCARD',
  ].filter(Boolean).join('\r\n') + '\r\n';
}

export function toVCards(records, lang = 'es') {
  return records.map((r) => toVCard(r, lang)).join('');
}

/* ------------------------------------------------------------ iCalendar -- */
export function toICal(events, lang = 'es') {
  const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${CONFIG.brandName}//AuctionAssist//ES`, 'CALSCALE:GREGORIAN',
  ];
  for (const e of events) {
    const start = new Date(e.start);
    const end = new Date(e.end || start.getTime() + 45 * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@auctionassist.local`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${String(e.title).replace(/\n/g, ' ')}`,
      e.description ? `DESCRIPTION:${String(e.description).replace(/\n/g, '\\n')}` : '',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  void lang;
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------ Markdown --- */
export { toMarkdown, toPlainText };

export function toMarkdownAll(records, lang = 'es') {
  const en = lang === 'en';
  const head = [
    `# ${en ? 'Client portfolio' : 'Cartera de clientes'} · ${CONFIG.brandName}`,
    '',
    `${en ? 'Exported' : 'Exportado'}: ${fmtDate(new Date().toISOString(), lang, { dateStyle: 'full', timeStyle: 'short' })}  `,
    `${en ? 'Records' : 'Registros'}: **${records.length}**`,
    '',
    `| ID | ${en ? 'Client' : 'Cliente'} | ${en ? 'Stage' : 'Etapa'} | ${en ? 'Budget' : 'Presupuesto'} | ${en ? 'Looking for' : 'Busca'} |`,
    '|---|---|---|---|---|',
  ];
  for (const r of records) {
    const d = r.data || {};
    const stage = byId(PIPELINE_STAGES, r.crm?.stage || 'new');
    head.push(`| \`${r.id}\` | ${deepGet(d, 'contact.fullName') || '—'} | ${stage ? (stage.label[lang] || stage.label.es) : '—'} | $${fmtNumber(deepGet(d, 'budget.total') || 0, lang)} | ${headline(d, lang)} |`);
  }
  head.push('', '---', '');
  for (const r of records) head.push(toMarkdown(r, lang), '', '---', '');
  return head.join('\n');
}

/* ------------------------------------------------------ printable HTML --- */
export function toPrintableHtml(record, lang = 'es') {
  const en = lang === 'en';
  const d = record.data || {};
  const groups = summarize(d, lang);
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const sections = groups.map((g) => `
    <section class="grp">
      <h2>${esc(g.emoji)} ${esc(g.title)}</h2>
      <table>
        ${g.items.map((it) => `<tr><th>${esc(it.label)}</th><td>${esc(it.value).replace(/\n/g, '<br>')}</td></tr>`).join('')}
      </table>
    </section>`).join('');

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">
<title>${esc(record.id)} · ${esc(deepGet(d, 'contact.fullName') || '')}</title>
<style>
  :root{--ink:#101a29;--muted:#5b6779;--line:#dfe4ee;--gold:#a96a1c}
  *{box-sizing:border-box}
  body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);margin:0;padding:32px;max-width:820px}
  header{border-bottom:3px solid var(--gold);padding-bottom:14px;margin-bottom:22px}
  h1{margin:0 0 4px;font-size:22px}
  .meta{color:var(--muted);font-size:12px}
  .grp{margin-bottom:20px;break-inside:avoid}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);margin:0 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line)}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;width:38%;font-weight:500;color:var(--muted);padding:5px 10px 5px 0;vertical-align:top;font-size:13px}
  td{padding:5px 0;font-weight:600;vertical-align:top}
  tr{border-bottom:1px solid #f0f2f7}
  footer{margin-top:28px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
  @media print{body{padding:0}@page{margin:16mm}}
</style></head><body>
<header>
  <h1>${esc(deepGet(d, 'contact.fullName') || (en ? 'Client request' : 'Solicitud de cliente'))}</h1>
  <div class="meta">
    ${esc(record.id)} · ${esc(fmtDate(record.createdAt, lang, { dateStyle: 'long', timeStyle: 'short' }))}
    · ${esc(headline(d, lang))}
  </div>
</header>
${sections}
<footer>${esc(CONFIG.brandName)} · ${en ? 'Confidential client intake' : 'Levantamiento confidencial de cliente'}</footer>
</body></html>`;
}

/* ------------------------------------------------------- WhatsApp brief -- */
export function toWhatsApp(record, lang = 'es') {
  const en = lang === 'en';
  const d = record.data || {};
  const lines = [
    `*${en ? 'REQUEST' : 'SOLICITUD'} ${record.id}*`,
    `👤 ${deepGet(d, 'contact.fullName') || '—'}`,
    `📞 ${deepGet(d, 'contact.phone') || '—'}`,
    `🚗 ${headline(d, lang)}`,
  ];
  const budget = deepGet(d, 'budget.total');
  if (budget) lines.push(`💵 ${en ? 'Budget' : 'Presupuesto'}: $${fmtNumber(budget, lang)}`);
  const titles = deepGet(d, 'condition.titles') || [];
  if (titles.length) lines.push(`📄 ${en ? 'Titles' : 'Títulos'}: ${titles.join(', ')}`);
  const notes = deepGet(d, 'references.notes');
  if (notes) lines.push(`📝 ${String(notes).slice(0, 300)}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------ filenames -- */
export function exportFilename(kind, ext, count = null) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `lsc-${kind}${count !== null ? `-${count}` : ''}-${stamp}.${ext}`;
}
