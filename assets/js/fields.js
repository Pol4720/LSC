/* =========================================================================
   LSC · Field renderers
   ---------------------------------------------------------------------------
   One function per field type. Every renderer receives the same context and
   reports changes through ctx.onChange(fieldId, value), so the form shell
   stays completely generic.
   ========================================================================= */

import { el, clear, icon, I18n, L, t, fmtNumber, norm, fuzzyScore, deepGet } from './core.js';
import { GLOSSARY } from './catalogs.js';
import { isRequired } from './schema.js';

/* --------------------------------------------------------------- shell --- */

/**
 * @param {object} field  schema field
 * @param {object} ctx    {data, errors, onChange, lang}
 * @returns {HTMLElement}
 */
export function renderField(field, ctx) {
  if (field.type === 'info') return renderInfo(field, ctx);

  const value = deepGet(ctx.data, field.id);
  const error = ctx.errors?.[field.id] || null;
  const wrap = el('div.field', {
    dataset: { field: field.id, type: field.type },
    class: `w-${field.width || 'full'}`,
  });

  const labelId = `lbl-${field.id.replace(/\./g, '-')}`;
  const control = BUILDERS[field.type]
    ? BUILDERS[field.type](field, value, ctx, labelId)
    : BUILDERS.text(field, value, ctx, labelId);

  const groupTypes = ['radio', 'multi', 'segmented', 'chips', 'priority', 'yearrange', 'repeater'];
  const isGroup = groupTypes.includes(field.type);

  const labelNode = el(isGroup ? 'div.label' : 'label.label', { id: labelId });
  if (!isGroup && control.dataset?.controlId) labelNode.setAttribute('for', control.dataset.controlId);
  labelNode.append(L(field.label));
  if (isRequired(field, ctx.data)) labelNode.append(el('span.req', { text: '*', 'aria-hidden': 'true' }));
  else if (field.showOptional !== false && field.type !== 'switch') {
    labelNode.append(el('span.opt', { text: `(${t('common.optional')})` }));
  }
  if (field.glossary && GLOSSARY[field.glossary]) labelNode.append(glossaryToggle(field.glossary, wrap));

  if (field.type !== 'switch') wrap.append(labelNode);
  if (field.help) wrap.append(el('p.help', { text: L(field.help) }));
  wrap.append(control);

  if (error) {
    wrap.append(el('div.err', { role: 'alert' }, icon('warn'), el('span', { text: t(error.key, error.vars) })));
    if (isGroup) wrap.classList.add('has-error');
  }
  return wrap;
}

function glossaryToggle(key, host) {
  const entry = GLOSSARY[key];
  const btn = el('button.info-btn', {
    type: 'button', 'aria-expanded': 'false',
    'aria-label': `${L(entry.term)} — ${I18n.lang === 'en' ? 'what is this?' : '¿qué es esto?'}`,
    text: '?',
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    const existing = host.querySelector(':scope > .info-panel');
    if (existing) existing.remove();
    if (!open) {
      host.append(el('div.info-panel',
        el('strong', { text: L(entry.term) }), ' — ', L(entry.text)));
    }
  });
  return btn;
}

function renderInfo(field, ctx) {
  const variant = field.variant || 'info';
  const emoji = { info: 'ℹ️', warn: '⚠️', ok: '✅', brand: '💡', danger: '🚫' }[variant] || 'ℹ️';
  return el('div.field.w-full.field-info', { dataset: { field: field.id, type: 'info' } },
    el(`div.callout.callout-${variant}`,
      el('span.ci', { text: emoji, 'aria-hidden': 'true' }),
      el('div.stack.gap-1',
        field.label ? el('strong', { text: L(field.label) }) : null,
        field.help ? el('span', { text: L(field.help) }) : null,
      )));
}

/* ------------------------------------------------------------ builders --- */
const cid = (field) => `f-${field.id.replace(/\./g, '-')}`;

const BUILDERS = {
  /* ---- plain inputs --------------------------------------------------- */
  text: textLike('text'),
  tel: textLike('tel'),
  email: textLike('email'),
  url: textLike('url'),
  date: textLike('date'),
  year: textLike('number'),

  number(field, value, ctx) {
    const input = el('input.input', {
      type: 'number', id: cid(field), value: value ?? '',
      min: field.min, max: field.max, step: field.step || 1,
      placeholder: L(field.placeholder || ''),
      inputmode: 'decimal',
      'aria-invalid': ctx.errors?.[field.id] ? 'true' : null,
      oninput: (e) => ctx.onChange(field.id, e.target.value === '' ? null : Number(e.target.value)),
    });
    input.dataset.controlId = cid(field);
    const wrap = el('div', input);
    wrap.dataset.controlId = cid(field);
    return wrap;
  },

  textarea(field, value, ctx) {
    const ta = el('textarea.textarea', {
      id: cid(field), rows: field.rows || 4,
      placeholder: L(field.placeholder || ''),
      maxLength: field.maxLength || null,
      'aria-invalid': ctx.errors?.[field.id] ? 'true' : null,
      oninput: (e) => { ctx.onChange(field.id, e.target.value); if (counter) paint(); },
    });
    ta.value = value ?? '';
    const counter = field.maxLength ? el('div.text-xs.text-subtle.text-right') : null;
    const paint = () => { counter.textContent = `${ta.value.length} / ${field.maxLength}`; };
    if (counter) paint();
    const wrap = el('div.stack.gap-1', ta, counter);
    wrap.dataset.controlId = cid(field);
    return wrap;
  },

  /* ---- money ----------------------------------------------------------- */
  money(field, value, ctx) {
    const id = cid(field);
    const num = Number(value);
    const current = Number.isFinite(num) ? num : (field.default ?? '');

    const input = el('input.input', {
      type: 'text', id, inputmode: 'numeric',
      value: current === '' ? '' : fmtNumber(current, I18n.lang),
      placeholder: L(field.placeholder || '0'),
      'aria-invalid': ctx.errors?.[field.id] ? 'true' : null,
      'aria-describedby': `${id}-hint`,
    });

    const sliderMax = field.sliderMax ?? field.max ?? 100000;
    const range = field.slider ? el('input', {
      type: 'range', min: field.min ?? 0, max: sliderMax, step: field.step || 100,
      value: clampNum(current || field.min || 0, field.min ?? 0, sliderMax),
      'aria-label': L(field.label),
    }) : null;

    const hint = el('div.money-hint.text-sm.text-muted', { id: `${id}-hint` });
    const paintHint = (v) => {
      const n = Number(v);
      hint.textContent = Number.isFinite(n) && n > 0
        ? (I18n.lang === 'en' ? `≈ ${fmtNumber(n, 'en')} US dollars` : `≈ ${fmtNumber(n, 'es')} dólares`)
        : '';
      if (range) {
        const min = field.min ?? 0;
        const pct = ((clampNum(n || min, min, sliderMax) - min) / (sliderMax - min)) * 100;
        range.style.setProperty('--pct', `${pct}%`);
      }
    };

    input.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/[^\d]/g, '');
      const n = raw === '' ? null : Number(raw);
      const caretAtEnd = e.target.selectionStart === e.target.value.length;
      e.target.value = n === null ? '' : fmtNumber(n, I18n.lang);
      if (caretAtEnd) e.target.setSelectionRange(e.target.value.length, e.target.value.length);
      if (range && n !== null) range.value = clampNum(n, field.min ?? 0, sliderMax);
      paintHint(n);
      ctx.onChange(field.id, n);
    });

    if (range) {
      range.addEventListener('input', (e) => {
        const n = Number(e.target.value);
        input.value = fmtNumber(n, I18n.lang);
        paintHint(n);
        ctx.onChange(field.id, n);
      });
    }
    paintHint(current);

    const wrap = el('div.stack.gap-3',
      el('div.input-affix.has-prefix', el('span.prefix', { text: '$' }), input),
      range,
      hint,
    );
    wrap.dataset.controlId = id;
    return wrap;
  },

  /* ---- select ---------------------------------------------------------- */
  select(field, value, ctx) {
    const sel = el('select.select', {
      id: cid(field),
      'aria-invalid': ctx.errors?.[field.id] ? 'true' : null,
      onchange: (e) => ctx.onChange(field.id, e.target.value || null),
    });
    sel.append(el('option', { value: '', text: t('common.select') }));
    for (const o of field.options || []) {
      sel.append(el('option', { value: o.id, text: L(o.label), selected: value === o.id }));
    }
    sel.value = value ?? '';
    const wrap = el('div', sel);
    wrap.dataset.controlId = cid(field);
    return wrap;
  },

  /* ---- segmented ------------------------------------------------------- */
  segmented(field, value, ctx) {
    const group = el('div.segmented', { role: 'radiogroup', 'aria-labelledby': `lbl-${field.id.replace(/\./g, '-')}` });
    for (const o of field.options || []) {
      const input = el('input', {
        type: 'radio', name: field.id, value: o.id, checked: value === o.id,
        onchange: () => ctx.onChange(field.id, o.id),
      });
      group.append(el('label', input,
        o.emoji ? el('span', { text: o.emoji + ' ', 'aria-hidden': 'true' }) : null,
        el('span', { text: L(o.label) })));
    }
    return group;
  },

  /* ---- radio / multi tiles --------------------------------------------- */
  radio: choiceTiles(false),
  multi: choiceTiles(true),

  /* ---- chips ----------------------------------------------------------- */
  chips(field, value, ctx) {
    const selected = new Set(Array.isArray(value) ? value : []);
    const host = el('div.stack.gap-3');
    const list = el('div.chips');
    let query = '';

    const search = field.searchable ? el('div.input-affix.has-prefix',
      el('span.prefix', icon('search')),
      el('input.input', {
        type: 'search', placeholder: t('common.search'),
        'aria-label': `${L(field.label)} — ${t('common.search')}`,
        oninput: (e) => { query = e.target.value; paint(); },
      })) : null;

    const paint = () => {
      clear(list);
      const opts = field.options || [];
      const q = norm(query);
      let shown = opts.filter((o) => !q || fuzzyScore(q, L(o.label)) > 0.3 || selected.has(o.id));
      if (!q && field.highlight) {
        const hi = new Set(field.highlight);
        shown = [...shown.filter((o) => hi.has(o.id) || selected.has(o.id)),
                 ...shown.filter((o) => !hi.has(o.id) && !selected.has(o.id))];
        if (!expanded) shown = shown.slice(0, field.collapseTo || 12);
      }
      for (const o of shown) {
        const on = selected.has(o.id);
        const input = el('input', {
          type: 'checkbox', checked: on,
          onchange: (e) => {
            if (e.target.checked) selected.add(o.id); else selected.delete(o.id);
            ctx.onChange(field.id, Array.from(selected));
            chip.dataset.checked = String(e.target.checked);
          },
        });
        const chip = el('label.chip', { dataset: { checked: String(on) } },
          input,
          o.emoji ? el('span', { text: o.emoji, 'aria-hidden': 'true' }) : null,
          el('span', { text: L(o.label) }));
        list.append(chip);
      }
      const total = opts.length;
      if (!q && field.highlight && total > (field.collapseTo || 12)) {
        list.append(el('button.chip', {
          type: 'button',
          onclick: (e) => { e.preventDefault(); expanded = !expanded; paint(); },
          text: expanded
            ? (I18n.lang === 'en' ? '− Show less' : '− Ver menos')
            : (I18n.lang === 'en' ? `+ ${total - (field.collapseTo || 12)} more` : `+ ${total - (field.collapseTo || 12)} más`),
        }));
      }
      if (!shown.length) list.append(el('span.text-muted.text-sm', { text: I18n.lang === 'en' ? 'No matches' : 'Sin resultados' }));
    };

    let expanded = false;
    if (search) host.append(search);
    host.append(list);
    paint();
    return host;
  },

  /* ---- free tags -------------------------------------------------------- */
  tags(field, value, ctx) {
    const items = Array.isArray(value) ? [...value] : [];
    const list = el('div.chips');
    const input = el('input.input', {
      type: 'text', id: cid(field),
      placeholder: L(field.placeholder || { es: 'Escribe y pulsa Enter', en: 'Type and press Enter' }),
      'aria-label': L(field.label),
    });

    const commit = () => {
      const v = input.value.trim();
      if (!v) return;
      const dup = items.some((x) => norm(x) === norm(v));
      if (!dup) { items.push(v); ctx.onChange(field.id, [...items]); paint(); }
      input.value = '';
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
      else if (e.key === 'Backspace' && !input.value && items.length) {
        items.pop(); ctx.onChange(field.id, [...items]); paint();
      }
    });
    input.addEventListener('blur', commit);

    const paint = () => {
      clear(list);
      items.forEach((item, i) => {
        list.append(el('span.tag',
          el('span', { text: item }),
          el('button', {
            type: 'button', 'aria-label': `${t('common.remove')} ${item}`, text: '×',
            onclick: () => { items.splice(i, 1); ctx.onChange(field.id, [...items]); paint(); },
          })));
      });
    };
    paint();

    const wrap = el('div.stack.gap-3', input, list);
    wrap.dataset.controlId = cid(field);
    return wrap;
  },

  /* ---- slider ----------------------------------------------------------- */
  slider(field, value, ctx) {
    const min = field.min ?? 0, max = field.max ?? 100, step = field.step || 1;
    const start = clampNum(Number(value ?? field.default ?? min), min, max);
    const out = el('output.slider-value', { for: cid(field) });
    const range = el('input', {
      type: 'range', id: cid(field), min, max, step, value: start,
      'aria-describedby': `${cid(field)}-out`,
      oninput: (e) => { paint(Number(e.target.value)); ctx.onChange(field.id, Number(e.target.value)); },
    });
    const paint = (v) => {
      out.textContent = field.format ? field.format(v, I18n.lang)
        : `${fmtNumber(v, I18n.lang)}${field.unit ? ' ' + field.unit : ''}`;
      range.style.setProperty('--pct', `${((v - min) / (max - min)) * 100}%`);
    };
    paint(start);

    const scale = field.scaleLabels ? el('div.row.between.text-xs.text-subtle',
      el('span', { text: L(field.scaleLabels[0]) }),
      el('span', { text: L(field.scaleLabels[1]) })) : null;

    return el('div.range-wrap',
      el('div.row.between.gap-3',
        el('span.slider-out', { id: `${cid(field)}-out` }, out),
      ),
      range,
      scale,
    );
  },

  /* ---- year range ------------------------------------------------------- */
  yearrange(field, value, ctx) {
    const min = field.min ?? 1990, max = field.max ?? new Date().getFullYear() + 1;
    const v = value && typeof value === 'object' ? value : (field.default || { from: min, to: max });
    let from = clampNum(Number(v.from ?? min), min, max);
    let to = clampNum(Number(v.to ?? max), min, max);
    if (from > to) [from, to] = [to, from];

    const out = el('div.row.between.gap-3.text-lg',
      el('strong.year-from', { text: String(from) }),
      el('span.text-subtle', { text: '—' }),
      el('strong.year-to', { text: String(to) }));

    const fill = el('div.fill');
    const rail = el('div.rail');
    const a = el('input', { type: 'range', min, max, step: 1, value: from, 'aria-label': I18n.lang === 'en' ? 'From year' : 'Año desde' });
    const b = el('input', { type: 'range', min, max, step: 1, value: to, 'aria-label': I18n.lang === 'en' ? 'To year' : 'Año hasta' });

    const paint = () => {
      out.querySelector('.year-from').textContent = String(from);
      out.querySelector('.year-to').textContent = String(to);
      const p1 = ((from - min) / (max - min)) * 100;
      const p2 = ((to - min) / (max - min)) * 100;
      fill.style.left = `${p1}%`;
      fill.style.width = `${Math.max(0, p2 - p1)}%`;
    };
    const push = () => ctx.onChange(field.id, { from, to });

    a.addEventListener('input', () => {
      from = Math.min(Number(a.value), to);
      a.value = from; paint(); push();
    });
    b.addEventListener('input', () => {
      to = Math.max(Number(b.value), from);
      b.value = to; paint(); push();
    });
    paint();

    return el('div.stack.gap-2', out, el('div.dual-range', rail, fill, a, b));
  },

  /* ---- switch ------------------------------------------------------------ */
  switch(field, value, ctx) {
    const input = el('input', {
      type: 'checkbox', id: cid(field), checked: value === true,
      onchange: (e) => ctx.onChange(field.id, e.target.checked),
    });
    const label = el('label.switch',
      input,
      el('span.track', el('span.thumb')),
      el('span.grow', { text: L(field.label) }),
    );
    if (isRequired(field, ctx.data)) label.append(el('span.req', { text: '*' }));
    return label;
  },

  /* ---- priority picker ---------------------------------------------------- */
  priority(field, value, ctx) {
    const source = deepGet(ctx.data, field.sourceField) || [];
    const pool = (field.options || []).filter((o) => source.includes(o.id));
    const chosen = (Array.isArray(value) ? value : []).filter((id) => source.includes(id));
    const host = el('div.stack.gap-3');
    const list = el('div.chips');

    const paint = () => {
      clear(list);
      if (!pool.length) {
        list.append(el('span.text-muted.text-sm', {
          text: I18n.lang === 'en' ? 'Pick some features above first.' : 'Selecciona antes algún equipamiento arriba.',
        }));
        return;
      }
      for (const o of pool) {
        const rank = chosen.indexOf(o.id);
        const on = rank >= 0;
        const chip = el('button.chip', {
          type: 'button', dataset: { checked: String(on) },
          'aria-pressed': String(on),
          onclick: () => {
            const i = chosen.indexOf(o.id);
            if (i >= 0) chosen.splice(i, 1);
            else if (chosen.length < (field.max || 3)) chosen.push(o.id);
            ctx.onChange(field.id, [...chosen]);
            paint();
          },
        },
          on ? el('span.rank', { text: `${rank + 1}` }) : null,
          o.emoji ? el('span', { text: o.emoji, 'aria-hidden': 'true' }) : null,
          el('span', { text: L(o.label) }));
        list.append(chip);
      }
      host.querySelector('.pr-count').textContent = `${chosen.length} / ${field.max || 3}`;
    };

    host.append(el('div.row.between',
      el('span.text-sm.text-muted', { text: I18n.lang === 'en' ? 'Tap to rank' : 'Toca para priorizar' }),
      el('span.pr-count.badge.badge-brand', { text: '0' })));
    host.append(list);
    paint();
    return host;
  },

  /* ---- repeater ----------------------------------------------------------- */
  repeater(field, value, ctx) {
    const rows = Array.isArray(value) && value.length ? value.map((r) => ({ ...r })) : [{}];
    const host = el('div.stack.gap-3');
    const list = el('div.stack.gap-3');

    const push = () => ctx.onChange(field.id, rows.filter((r) => Object.values(r).some((x) => x)));

    const paint = () => {
      clear(list);
      rows.forEach((row, i) => {
        const card = el('div.repeater-row',
          el('div.repeater-grid', ...field.item.map((sub) => {
            const input = el(sub.type === 'textarea' ? 'textarea.textarea' : 'input.input', {
              type: sub.type === 'textarea' ? null : (sub.type === 'url' ? 'url' : 'text'),
              placeholder: L(sub.placeholder || sub.label || ''),
              'aria-label': `${L(field.label)} ${i + 1} — ${L(sub.label)}`,
              value: row[sub.id] ?? '',
              oninput: (e) => { row[sub.id] = e.target.value; push(); },
            });
            return el('div.field', el('span.text-xs.text-subtle', { text: L(sub.label) }), input);
          })),
          rows.length > 1 ? el('button.btn.btn-ghost.btn-icon.btn-sm.repeater-del', {
            type: 'button', 'aria-label': t('common.remove'),
            onclick: () => { rows.splice(i, 1); push(); paint(); },
          }, icon('trash')) : null,
        );
        list.append(card);
      });
      addBtn.disabled = rows.length >= (field.max || 10);
    };

    const addBtn = el('button.btn.btn-outline.btn-sm', {
      type: 'button',
      onclick: () => { rows.push({}); paint(); },
    }, icon('plus'), el('span', { text: L(field.addLabel || { es: 'Añadir', en: 'Add' }) }));

    host.append(list, el('div', addBtn));
    paint();
    return host;
  },
};

/* ---------------------------------------------------------- factories ---- */
function textLike(inputType) {
  return function build(field, value, ctx) {
    const input = el('input.input', {
      type: inputType,
      id: cid(field),
      value: value ?? '',
      placeholder: L(field.placeholder || ''),
      autocomplete: field.autocomplete || 'off',
      maxLength: field.maxLength || null,
      min: field.min ?? null,
      max: field.max ?? null,
      inputmode: inputType === 'tel' ? 'tel' : inputType === 'number' ? 'numeric' : null,
      'aria-invalid': ctx.errors?.[field.id] ? 'true' : null,
      oninput: (e) => ctx.onChange(field.id, inputType === 'number'
        ? (e.target.value === '' ? null : Number(e.target.value))
        : e.target.value),
    });
    const wrap = el('div', input);
    wrap.dataset.controlId = cid(field);
    return wrap;
  };
}

function choiceTiles(multi) {
  return function build(field, value, ctx) {
    const cols = field.cols || 2;
    const group = el(`div.choices.cols-${cols}`, {
      role: multi ? 'group' : 'radiogroup',
      'aria-labelledby': `lbl-${field.id.replace(/\./g, '-')}`,
    });
    const selected = multi
      ? new Set(Array.isArray(value) ? value : [])
      : new Set(value !== null && value !== undefined ? [value] : []);

    for (const o of field.options || []) {
      const input = el('input', {
        type: multi ? 'checkbox' : 'radio',
        name: field.id,
        value: o.id,
        checked: selected.has(o.id),
        onchange: (e) => {
          if (multi) {
            if (e.target.checked) selected.add(o.id); else selected.delete(o.id);
            // "No preference"-style options are exclusive within their group.
            if (e.target.checked && ['any', 'anywhere'].includes(o.id)) {
              selected.clear(); selected.add(o.id);
              group.querySelectorAll('input').forEach((n) => { n.checked = n.value === o.id; });
            } else if (e.target.checked) {
              ['any', 'anywhere'].forEach((x) => {
                if (selected.delete(x)) {
                  const n = group.querySelector(`input[value="${x}"]`);
                  if (n) n.checked = false;
                }
              });
            }
            ctx.onChange(field.id, Array.from(selected));
          } else {
            ctx.onChange(field.id, o.id);
          }
        },
      });
      group.append(el('label.choice', { dataset: { multi: String(multi) } },
        input,
        el('span.mark', { 'aria-hidden': 'true' }),
        el('span.ch-body',
          el('span.ch-title',
            o.emoji ? el('span.ch-emoji', { text: o.emoji, 'aria-hidden': 'true' }) : null,
            el('span', { text: L(o.label) })),
          o.desc ? el('span.ch-desc', { text: L(o.desc) }) : null,
        )));
    }
    return group;
  };
}

const clampNum = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
