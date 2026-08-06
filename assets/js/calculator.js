/* =========================================================================
   LSC · All-in cost calculator UI
   ---------------------------------------------------------------------------
   Shared by the public calculator page and the per-client "Cost plan" tab.
   Two directions: a budget solves for the highest safe bid, a known hammer
   price solves for the out-the-door total.
   ========================================================================= */

import { el, clear, icon, I18n, L, t, toast, copyText, fmtMoney } from './core.js';
import { AUCTIONS } from './catalogs.js';
import { DEFAULT_FEES, estimate, maxBidForBudget, LINE_LABELS, GROUP_LABELS } from './fees.js';

/**
 * @param {object} seed  initial values
 * @param {object} opts  {fees, onSave(text), saveLabel}
 * @returns {HTMLElement}
 */
export function calculatorPanel(seed = {}, opts = {}) {
  const en = () => I18n.lang === 'en';
  const fees = opts.fees || DEFAULT_FEES;

  const st = {
    mode: seed.mode || 'budget',
    hammer: seed.hammer ?? 6000,
    budget: seed.budget ?? 10000,
    auction: seed.auction || 'copart',
    miles: seed.miles ?? 0,
    nonRunning: seed.nonRunning ?? false,
    oversize: seed.oversize ?? false,
    enclosed: false,
    includeBroker: true,
    repairBudget: seed.repairBudget ?? 0,
    taxRate: 0,
    exportMode: seed.exportMode && seed.exportMode !== 'none' ? seed.exportMode : 'none',
    extra: 0,
  };

  const out = el('div.card.card-solid.card-pad.calc-out', { 'aria-live': 'polite' });
  const controls = el('div.stack.gap-4');

  const numField = (label, key, o = {}) => {
    const input = el('input.input', {
      type: 'number', value: st[key], min: o.min ?? 0, step: o.step ?? 100, inputmode: 'numeric',
      oninput: (e) => { st[key] = Number(e.target.value) || 0; recompute(); },
    });
    return el('div.field', el('label.label', { text: label }),
      o.prefix ? el('div.input-affix.has-prefix', el('span.prefix', { text: o.prefix }), input) : input);
  };

  const toggle = (label, key) => el('label.switch',
    el('input', {
      type: 'checkbox', checked: st[key],
      onchange: (e) => { st[key] = e.target.checked; recompute(); },
    }),
    el('span.track', el('span.thumb')), el('span', { text: label }));

  function render() {
    clear(controls);

    const modeSeg = el('div.segmented', { role: 'radiogroup' },
      ...[['budget', en() ? 'I have a budget' : 'Tengo un presupuesto'],
          ['hammer', en() ? 'I know the bid' : 'Sé la puja']].map(([id, label]) =>
        el('label',
          el('input', {
            type: 'radio', name: 'calc-mode', checked: st.mode === id,
            onchange: () => { st.mode = id; render(); },
          }),
          el('span', { text: label }))));

    const auctionSel = el('select.select', { onchange: (e) => { st.auction = e.target.value; recompute(); } });
    for (const a of AUCTIONS.filter((x) => x.id !== 'other')) {
      auctionSel.append(el('option', { value: a.id, text: `${a.emoji} ${L(a.label)}`, selected: st.auction === a.id }));
    }

    const exportSel = el('select.select', { onchange: (e) => { st.exportMode = e.target.value; recompute(); } });
    for (const [id, label] of [
      ['none', en() ? 'Stays in the US' : 'Se queda en EE.UU.'],
      ['roro', 'RoRo'],
      ['container20', en() ? 'Shared container' : 'Contenedor compartido'],
      ['container40', en() ? 'Exclusive container' : 'Contenedor exclusivo'],
    ]) exportSel.append(el('option', { value: id, text: label, selected: st.exportMode === id }));

    const taxSel = el('select.select', { onchange: (e) => { st.taxRate = Number(e.target.value); recompute(); } });
    for (const [v, label] of [[0, en() ? 'No sales tax' : 'Sin impuesto'], [0.06, '6%'], [0.07, '7%'], [0.0825, '8.25%']]) {
      taxSel.append(el('option', { value: String(v), text: label, selected: st.taxRate === v }));
    }

    controls.append(
      el('div.field', el('label.label', { text: en() ? 'Starting point' : 'Punto de partida' }), modeSeg),
      st.mode === 'budget'
        ? numField(en() ? 'All-in budget' : 'Presupuesto todo incluido', 'budget', { prefix: '$', step: 250 })
        : numField(en() ? 'Hammer price' : 'Precio de martillo', 'hammer', { prefix: '$', step: 25 }),
      el('div.field', el('label.label', { text: en() ? 'Auction' : 'Subasta' }), auctionSel),
      numField(en() ? 'Transport distance (miles)' : 'Distancia de transporte (millas)', 'miles', { step: 50 }),
      numField(en() ? 'Repair budget' : 'Presupuesto de reparación', 'repairBudget', { prefix: '$', step: 100 }),
      numField(en() ? 'Other costs' : 'Otros gastos', 'extra', { prefix: '$', step: 50 }),
      el('div.field', el('label.label', { text: en() ? 'Destination' : 'Destino' }), exportSel),
      el('div.field', el('label.label', { text: en() ? 'Sales tax' : 'Impuesto sobre la venta' }), taxSel),
      el('div.stack.gap-3',
        toggle(en() ? 'Vehicle does not run' : 'El vehículo no arranca', 'nonRunning'),
        toggle(en() ? 'Oversize (SUV / pickup / van)' : 'Grande (SUV / pickup / van)', 'oversize'),
        toggle(en() ? 'Enclosed carrier' : 'Transporte cerrado', 'enclosed'),
        toggle(en() ? 'Include representation fee' : 'Incluir comisión de representación', 'includeBroker')),
    );
    recompute();
  }

  function currentResult() {
    const o = {
      auction: st.auction, miles: st.miles, nonRunning: st.nonRunning, oversize: st.oversize,
      enclosed: st.enclosed, includeBroker: st.includeBroker, repairBudget: st.repairBudget,
      taxRate: st.taxRate, exportMode: st.exportMode, extra: st.extra, fees,
    };
    return st.mode === 'budget'
      ? maxBidForBudget(st.budget, o)
      : { maxBid: st.hammer, estimate: estimate({ ...o, hammer: st.hammer }) };
  }

  function breakdownText(result) {
    const lines = [
      `${en() ? 'Max hammer bid' : 'Puja máxima'}: ${fmtMoney(result.maxBid, { lang: I18n.lang })}`,
    ];
    for (const line of result.estimate.lines) {
      lines.push(`· ${L(LINE_LABELS[line.id] || line.id)}: ${fmtMoney(line.amount, { lang: I18n.lang })}`);
    }
    lines.push(`TOTAL: ${fmtMoney(result.estimate.total, { lang: I18n.lang })}`);
    return lines.join('\n');
  }

  function recompute() {
    const result = currentResult();
    const est = result.estimate;
    clear(out);

    out.append(el('div.stack.gap-1',
      el('span.stat-label', {
        text: st.mode === 'budget'
          ? (en() ? 'Maximum hammer bid' : 'Puja máxima recomendada')
          : (en() ? 'Hammer price' : 'Precio de martillo'),
      }),
      el('span.stat-value', { text: fmtMoney(result.maxBid, { lang: I18n.lang }) })));

    if (result.insufficient) {
      out.append(el('div.callout.callout-warn', el('span.ci', { text: '⚠️' }),
        el('span', { text: en() ? 'Fixed costs already exceed this budget.' : 'Los gastos fijos ya superan este presupuesto.' })));
    }

    const groups = {};
    for (const line of est.lines) (groups[line.group] ||= []).push(line);
    for (const [group, lines] of Object.entries(groups)) {
      out.append(el('div.calc-group-title', { text: L(GROUP_LABELS[group] || group) }));
      for (const line of lines) {
        out.append(el('div.calc-line',
          el('span.cl-name', { text: L(LINE_LABELS[line.id] || line.id) }),
          el('strong', { text: fmtMoney(line.amount, { lang: I18n.lang }) })));
      }
    }

    out.append(el('div.calc-total',
      el('span', { text: 'Total' }),
      el('span', { text: fmtMoney(est.total, { lang: I18n.lang }) })));

    const actions = el('div.row.gap-2.wrap', { style: { marginTop: 'var(--sp-4)' } },
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: async () => {
          const ok = await copyText(breakdownText(result));
          toast(ok ? t('common.copied') : 'Error', ok ? 'ok' : 'danger');
        },
      }, icon('copy'), el('span', { text: en() ? 'Copy breakdown' : 'Copiar desglose' })));

    if (opts.onSave) {
      actions.append(el('button.btn.btn-sm.btn-primary', {
        type: 'button',
        onclick: () => opts.onSave(breakdownText(result), result),
      }, icon('save'), el('span', { text: opts.saveLabel || (en() ? 'Save to client' : 'Guardar en el cliente') })));
    }
    out.append(actions);
  }

  render();
  return el('div.calc-grid', el('div.card.card-solid.card-pad', controls), out);
}
