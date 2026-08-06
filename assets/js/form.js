/* =========================================================================
   LSC · Intake form application
   ---------------------------------------------------------------------------
   A schema-driven wizard that works offline, autosaves, seals every answer
   with the advisor's public key and then delivers it through whichever channel
   is available: live relay → repository → share link → download.
   ========================================================================= */

import {
  $, el, clear, icon, I18n, Theme, L, t, uid, deepGet, deepSet, clone,
  createStore, toast, copyText, downloadBlob, buildToolbar, debounce, fmtNumber,
} from './core.js';
import { visibleSteps, visibleFields, makeDefaults, SCHEMA_VERSION } from './schema.js';
import { renderField } from './fields.js';
import { validateStep, completeness } from './validate.js';
import { summarize, headline, deriveProfile, toPlainText } from './summary.js';
import { seal, packPayload } from './crypto.js';
import { postToRelay } from './github.js';
import { maxBidForBudget, LINE_LABELS } from './fees.js';
import { CONFIG } from './config.js';

const store = createStore('intake');
const DRAFT_KEY = 'draft';

/* =============================================================== state === */
const state = {
  mode: 'full',          // 'full' | 'express'
  stepIndex: 0,
  data: makeDefaults(),
  errors: {},
  touched: new Set(),
  submitted: null,       // record once sent
  advisorKey: null,      // public JWK, or null when unavailable
  startedAt: new Date().toISOString(),
  prefillFrom: null,
};

let root, headerEl, progressEl, stepperEl, mainEl, navEl;

/* ================================================================ boot === */
export async function boot(mount) {
  I18n.init();
  Theme.init();
  root = mount;

  restoreDraft();
  readUrlOptions();
  await loadAdvisorKey();

  buildChrome();
  I18n.onChange(() => { buildChrome(); render(); });
  render();

  window.addEventListener('beforeunload', () => saveDraft.flush());
  window.addEventListener('popstate', (e) => {
    if (typeof e.state?.step === 'number') { state.stepIndex = e.state.step; render(false); }
  });
}

function readUrlOptions() {
  const p = new URLSearchParams(location.search);
  if (p.get('mode') === 'express') state.mode = 'express';
  if (p.get('advisor') === '1') state.data.meta = { ...(state.data.meta || {}), filledByAdvisor: true };
  if (p.get('ref')) state.data.meta = { ...(state.data.meta || {}), referral: p.get('ref') };
}

async function loadAdvisorKey() {
  try {
    const res = await fetch(new URL(CONFIG.advisorKeyPath, document.baseURI).href, { cache: 'no-store' });
    if (!res.ok) return;
    const key = await res.json();
    if (key && key.kty === 'EC' && key.x && key.y) state.advisorKey = key;
  } catch { /* offline or not published yet — we degrade to link delivery */ }
}

/* =============================================================== chrome == */
function buildChrome() {
  clear(root);
  const tools = buildToolbar();

  headerEl = el('header.app-header',
    el('div.bar',
      el('a.brand', { href: './', 'aria-label': t('app.name') },
        el('span.brand-mark', icon('gavel')),
        el('span.brand-text',
          el('span.brand-name', { text: t('app.name') }),
          el('span.brand-sub', { text: I18n.lang === 'en' ? 'Vehicle intake' : 'Levantamiento de necesidades' }),
        )),
      el('div.grow'),
      tools.node,
    ),
    el('div.progress-bar', el('i', { style: { width: '0%' } })),
    el('nav.stepper', { 'aria-label': I18n.lang === 'en' ? 'Steps' : 'Pasos' }),
  );
  progressEl = headerEl.querySelector('.progress-bar > i');
  stepperEl = headerEl.querySelector('.stepper');

  mainEl = el('main.form-main', { id: 'main' });
  navEl = el('div.form-nav', el('div.inner'));

  root.append(el('div.app-shell', headerEl, mainEl, navEl));
}

/* ============================================================== render === */
function render(scroll = true) {
  const steps = visibleSteps(state.mode);
  state.stepIndex = Math.max(0, Math.min(state.stepIndex, steps.length - 1));
  const step = steps[state.stepIndex];

  paintStepper(steps);
  paintProgress(steps);

  clear(mainEl);
  const wrap = el('div.form-wrap');

  if (state.submitted) wrap.append(renderSuccess());
  else if (step.kind === 'intro') wrap.append(renderIntro(step));
  else if (step.kind === 'review') wrap.append(renderReview(step));
  else wrap.append(renderStep(step));

  mainEl.append(wrap);
  paintNav(steps);

  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  const focusTarget = mainEl.querySelector('h1, h2, .step-title');
  focusTarget?.setAttribute('tabindex', '-1');
  focusTarget?.focus?.({ preventScroll: true });
}

function paintProgress(steps) {
  const c = completeness(state.data, state.mode);
  const stepPct = ((state.stepIndex) / Math.max(1, steps.length - 1)) * 100;
  progressEl.style.width = `${state.submitted ? 100 : Math.max(stepPct, c.percent * 0.35)}%`;
}

function paintStepper(steps) {
  clear(stepperEl);
  if (state.submitted) { stepperEl.classList.add('hidden'); return; }
  stepperEl.classList.remove('hidden');
  steps.forEach((s, i) => {
    if (s.kind === 'intro') return;
    const isCurrent = i === state.stepIndex;
    const done = i < state.stepIndex;
    const hasError = Object.keys(validateStep(s, state.data, state.mode))
      .some((id) => state.touched.has(id)) && i < state.stepIndex;
    const btn = el(`button.step-dot${done ? '.done' : ''}${hasError ? '.has-error' : ''}`, {
      type: 'button',
      'aria-current': isCurrent ? 'step' : null,
      disabled: i > state.stepIndex + 1,
      onclick: () => goTo(i),
    },
      el('span.num', done && !hasError ? icon('check') : el('span', { text: String(i) })),
      el('span', { text: L(s.title) }));
    stepperEl.append(btn);
  });
  // Only scroll the stepper when the active chip is actually out of view —
  // a gratuitous smooth scroll on every render fights the user's own taps.
  const current = stepperEl.querySelector('[aria-current="step"]');
  if (current) {
    const chip = current.getBoundingClientRect();
    const rail = stepperEl.getBoundingClientRect();
    if (chip.left < rail.left || chip.right > rail.right) {
      current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }
}

/* ------------------------------------------------------------- screens --- */
function renderIntro(step) {
  const draftExists = store.get(DRAFT_KEY) && completeness(state.data, state.mode).answered > 2;
  const en = I18n.lang === 'en';

  return el('div.hero',
    el('span.hero-badge', icon('sparkles'), el('span', { text: en ? 'Free · No commitment' : 'Gratis · Sin compromiso' })),
    el('h1', el('span', { text: L(step.title).split(' ').slice(0, -1).join(' ') + ' ' }),
      el('span.grad', { text: L(step.title).split(' ').slice(-1)[0] })),
    el('p', { text: L(step.subtitle) }),

    el('div.mode-cards',
      modeCard({
        emoji: '⚡', mode: 'express',
        title: en ? 'Express' : 'Exprés',
        desc: en ? 'The essentials only. Perfect if you are in a hurry — we fill in the rest on the call.'
                 : 'Solo lo esencial. Perfecto si tienes prisa: el resto lo completamos en la llamada.',
        time: en ? '≈ 3 min' : '≈ 3 min',
      }),
      modeCard({
        emoji: '🎯', mode: 'full',
        title: en ? 'Complete' : 'Completo',
        desc: en ? 'Every detail, so we arrive at your session with real lots already picked.'
                 : 'Todos los detalles, para llegar a tu asesoría con lotes concretos ya seleccionados.',
        time: en ? '≈ 8 min' : '≈ 8 min',
        recommended: true,
      }),
    ),

    draftExists ? el('div.callout.callout-ok',
      el('span.ci', { text: '💾' }),
      el('div.stack.gap-2',
        el('strong', { text: en ? 'We found your saved answers' : 'Encontramos tus respuestas guardadas' }),
        el('span', { text: en ? 'Continue where you left off, or start fresh.' : 'Continúa donde lo dejaste, o empieza de nuevo.' }),
        el('div.row.gap-2.wrap',
          el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => goTo(1), text: en ? 'Continue' : 'Continuar' }),
          el('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: resetDraft, text: en ? 'Start over' : 'Empezar de nuevo' }),
        ))) : null,

    el('div.trust-row',
      trustItem('lock', en ? 'Encrypted end-to-end' : 'Cifrado de extremo a extremo'),
      trustItem('save', en ? 'Saves as you type' : 'Se guarda solo'),
      trustItem('shield', en ? 'Never shared with third parties' : 'Nunca se comparte con terceros'),
    ),
  );
}

function modeCard({ emoji, title, desc, time, mode, recommended }) {
  return el('button.mode-card', {
    type: 'button',
    onclick: () => { state.mode = mode; state.stepIndex = 1; saveDraft(); render(); },
  },
    el('div.row.between',
      el('span.mc-emoji', { text: emoji, 'aria-hidden': 'true' }),
      recommended ? el('span.badge.badge-brand', { text: I18n.lang === 'en' ? 'Recommended' : 'Recomendado' }) : null),
    el('span.mc-title', { text: title }),
    el('span.mc-desc', { text: desc }),
    el('span.mc-time', el('span.badge', icon('clock'), el('span', { text: time }))),
  );
}

const trustItem = (ico, text) => el('span.trust-item', icon(ico), el('span', { text }));

function renderStep(step) {
  const fields = visibleFields(step, state.data, state.mode);
  const ctx = {
    data: state.data,
    errors: state.errors,
    onChange: handleChange,
  };
  const grid = el('div.fields-grid');
  for (const f of fields) grid.append(renderField(f, ctx));

  return el('section',
    el('div.step-head',
      el('div.step-eyebrow', icon(step.icon || 'file'),
        el('span', { text: `${t('common.step')} ${state.stepIndex} ${t('common.of')} ${visibleSteps(state.mode).length - 1}` })),
      el('h2.step-title', step.emoji ? el('span.emoji', { text: step.emoji, 'aria-hidden': 'true' }) : null,
        el('span', { text: L(step.title) })),
      step.subtitle ? el('p.step-sub', { text: L(step.subtitle) }) : null,
    ),
    grid,
  );
}

function renderReview(step) {
  const en = I18n.lang === 'en';
  const groups = summarize(state.data, I18n.lang, state.mode);
  const box = el('section');

  box.append(el('div.step-head',
    el('div.step-eyebrow', icon('check'), el('span', { text: en ? 'Almost done' : 'Casi listo' })),
    el('h2.step-title', el('span.emoji', { text: '✅' }), el('span', { text: L(step.title) })),
    el('p.step-sub', { text: L(step.subtitle) })));

  box.append(budgetEstimateCard());

  for (const g of groups) {
    const list = el('dl.summary-list');
    for (const it of g.items) {
      list.append(el('div.summary-item',
        el('dt', { text: it.label }),
        el('dd', { text: it.value })));
    }
    const stepIdx = visibleSteps(state.mode).findIndex((s) => s.id === g.id);
    box.append(el('div.summary-group',
      el('div.summary-group-head',
        el('h4', el('span', { text: g.emoji, 'aria-hidden': 'true' }), el('span', { text: g.title })),
        stepIdx >= 0 ? el('button.btn.btn-ghost.btn-sm', {
          type: 'button', onclick: () => goTo(stepIdx),
        }, icon('edit'), el('span', { text: t('common.edit') })) : null),
      list));
  }

  const ctx = { data: state.data, errors: state.errors, onChange: handleChange };
  const consent = el('div.card.card-solid.card-pad.stack.gap-4');
  consent.append(el('h4', { text: en ? 'Consent' : 'Consentimiento' }));
  for (const f of visibleFields(step, state.data, state.mode)) consent.append(renderField(f, ctx));
  box.append(consent);

  return box;
}

function budgetEstimateCard() {
  const en = I18n.lang === 'en';
  const budget = Number(deepGet(state.data, 'budget.total')) || 0;
  if (!budget) return null;

  const repair = Number(deepGet(state.data, 'condition.repairBudget')) || 0;
  const exportMode = deepGet(state.data, 'logistics.exportMode') || 'none';
  const transportManaged = deepGet(state.data, 'logistics.transport') === 'managed';
  const oversize = (deepGet(state.data, 'vehicle.bodyTypes') || [])
    .some((b) => ['suv', 'pickup', 'minivan', 'van', 'heavy'].includes(b));

  const opts = {
    auction: 'copart',
    miles: transportManaged ? 600 : 0,
    oversize,
    nonRunning: deepGet(state.data, 'condition.runDrive') === 'no',
    repairBudget: repair,
    exportMode: exportMode === 'none' ? 'none' : exportMode,
  };
  const { maxBid, estimate: est, insufficient } = maxBidForBudget(budget, opts);

  if (insufficient) {
    return el('div.card.card-pad.callout.callout-warn',
      el('span.ci', { text: '⚠️' }),
      el('div.stack.gap-1',
        el('strong', { text: en ? 'Tight budget' : 'Presupuesto ajustado' }),
        el('span', {
          text: en
            ? 'With the costs you described, the fixed fees already consume the budget. We will look at options together.'
            : 'Con los costos que describiste, los gastos fijos ya consumen el presupuesto. Lo vemos juntos y buscamos opciones.',
        })));
  }

  const lines = est.lines
    .filter((l) => l.id !== 'hammer')
    .map((l) => el('div.estimate-line',
      el('span', { text: L(LINE_LABELS[l.id] || l.id) }),
      el('strong', { text: `$${fmtNumber(Math.round(l.amount), I18n.lang)}` })));

  return el('div.card.estimate-card.card-pad.stack.gap-3',
    el('div.row.gap-2', icon('calc'),
      el('strong', { text: en ? 'Estimated bidding power' : 'Poder de puja estimado' })),
    el('p.text-sm.text-muted', {
      text: en
        ? 'A first approximation based on your all-in budget. Your advisor confirms the exact numbers per lot.'
        : 'Una primera aproximación con tu presupuesto todo incluido. Tu asesor confirma los números exactos por lote.',
    }),
    el('div.estimate-line',
      el('span', { text: en ? 'Maximum hammer bid' : 'Puja máxima recomendada' }),
      el('strong.text-lg', { text: `$${fmtNumber(maxBid, I18n.lang)}` })),
    ...lines,
    el('div.estimate-line.total',
      el('span', { text: en ? 'All-in total' : 'Total todo incluido' }),
      el('span', { text: `$${fmtNumber(Math.round(est.total), I18n.lang)}` })),
  );
}

/* ------------------------------------------------------------ success ---- */
function renderSuccess() {
  const en = I18n.lang === 'en';
  const rec = state.submitted;
  const delivered = rec.delivery?.relay || rec.delivery?.repo;

  const box = el('div.success',
    el('div.success-mark', icon('check')),
    el('h1', { text: en ? 'All set!' : '¡Listo!' }),
    el('p.step-sub.text-center', {
      text: delivered
        ? (en ? 'Your request reached your advisor. We will contact you very soon through the channels you chose.'
              : 'Tu solicitud llegó a tu asesor. Te contactamos muy pronto por los canales que elegiste.')
        : (en ? 'Your answers are saved and encrypted. Send them to your advisor with one tap below.'
              : 'Tus respuestas están guardadas y cifradas. Envíaselas a tu asesor con un toque aquí abajo.'),
    }),
    el('div.ticket', icon('file'), el('span', { text: rec.id })),
  );

  if (!delivered) {
    box.append(el('p.text-sm.text-muted.text-center', {
      text: en ? 'Choose how to send it:' : 'Elige cómo enviarlo:',
    }));
  }

  const shareUrl = rec.shareUrl;
  const waText = `${en ? 'Hi! Here is my vehicle request' : '¡Hola! Aquí está mi solicitud de vehículo'} (${rec.id}):\n${shareUrl}`;

  box.append(el('div.delivery-grid',
    el('a.btn.btn-primary', {
      href: `https://wa.me/${CONFIG.advisorWhatsApp}?text=${encodeURIComponent(waText)}`,
      target: '_blank', rel: 'noopener',
    }, icon('whatsapp'), el('span', { text: 'WhatsApp' })),
    el('a.btn', {
      href: `mailto:${CONFIG.advisorEmail}?subject=${encodeURIComponent(`${en ? 'Vehicle request' : 'Solicitud de vehículo'} ${rec.id}`)}&body=${encodeURIComponent(waText)}`,
    }, icon('mail'), el('span', { text: en ? 'Email' : 'Correo' })),
    el('button.btn', {
      type: 'button',
      onclick: async () => {
        const ok = await copyText(shareUrl);
        toast(ok ? t('common.copied') : 'Error', ok ? 'ok' : 'danger');
      },
    }, icon('link'), el('span', { text: en ? 'Copy link' : 'Copiar enlace' })),
    el('button.btn', {
      type: 'button',
      onclick: () => downloadBlob(`${rec.id}.json`, JSON.stringify(rec.envelope || rec, null, 2), 'application/json'),
    }, icon('download'), el('span', { text: en ? 'Download file' : 'Descargar archivo' })),
  ));

  box.append(el('div.row.gap-3.wrap.center',
    el('button.btn.btn-ghost.btn-sm', {
      type: 'button',
      onclick: async () => {
        const ok = await copyText(toPlainText({ ...rec, data: state.data }, I18n.lang));
        toast(ok ? t('common.copied') : 'Error', ok ? 'ok' : 'danger');
      },
    }, icon('copy'), el('span', { text: en ? 'Copy summary as text' : 'Copiar resumen como texto' })),
    el('button.btn.btn-ghost.btn-sm', {
      type: 'button', onclick: () => window.print(),
    }, icon('print'), el('span', { text: t('common.print') })),
    el('button.btn.btn-ghost.btn-sm', {
      type: 'button',
      onclick: () => { resetDraft(); },
    }, icon('plus'), el('span', { text: en ? 'New request' : 'Nueva solicitud' })),
  ));

  celebrate();
  return box;
}

/* ---------------------------------------------------------------- nav ---- */
function paintNav(steps) {
  const inner = navEl.querySelector('.inner');
  clear(inner);
  if (state.submitted) { navEl.classList.add('hidden'); return; }
  navEl.classList.remove('hidden');
  const en = I18n.lang === 'en';
  const isFirst = state.stepIndex === 0;
  const isLast = state.stepIndex === steps.length - 1;

  if (!isFirst) {
    inner.append(el('button.btn.btn-ghost', {
      type: 'button', onclick: () => goTo(state.stepIndex - 1),
    }, icon('arrowLeft'), el('span', { text: t('common.back') })));
  }

  inner.append(el('span.save-hint.grow', { id: 'save-hint' },
    icon('save'), el('span', { text: en ? 'Saved automatically' : 'Guardado automáticamente' })));

  if (isFirst) {
    inner.append(el('button.btn.btn-primary.btn-lg', {
      type: 'button', onclick: () => { state.stepIndex = 1; render(); },
    }, el('span', { text: en ? 'Start' : 'Empezar' }), icon('arrowRight')));
  } else if (isLast) {
    inner.append(el('button.btn.btn-primary.btn-lg', {
      type: 'button', id: 'submit-btn', onclick: submit,
    }, icon('check'), el('span', { text: en ? 'Send my request' : 'Enviar mi solicitud' })));
  } else {
    inner.append(el('button.btn.btn-primary', {
      type: 'button', onclick: () => goTo(state.stepIndex + 1),
    }, el('span', { text: t('common.next') }), icon('arrowRight')));
  }
}

function goTo(index) {
  const steps = visibleSteps(state.mode);
  if (index > state.stepIndex) {
    const current = steps[state.stepIndex];
    const errs = validateStep(current, state.data, state.mode);
    if (Object.keys(errs).length) {
      state.errors = errs;
      Object.keys(errs).forEach((id) => state.touched.add(id));
      render(false);
      toast(t('err.fixFields'), 'warn');
      const firstBad = mainEl.querySelector('.field.has-error, [aria-invalid="true"]');
      (firstBad?.closest('.field') || firstBad)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    state.errors = {};
  }
  state.stepIndex = Math.max(0, Math.min(index, steps.length - 1));
  history.pushState({ step: state.stepIndex }, '', location.pathname + location.search);
  saveDraft();
  render();
}

/* ------------------------------------------------------------- changes --- */
function handleChange(fieldId, value) {
  deepSet(state.data, fieldId, value);
  state.touched.add(fieldId);
  if (state.errors[fieldId]) {
    const step = visibleSteps(state.mode)[state.stepIndex];
    const errs = validateStep(step, state.data, state.mode);
    if (!errs[fieldId]) { delete state.errors[fieldId]; scheduleRerender(); }
  }
  if (dependencyFields.has(fieldId)) scheduleRerender();
  saveDraft();
  paintProgress(visibleSteps(state.mode));
}

/** Fields whose value flips other fields' visibility — a change forces a repaint. */
const dependencyFields = new Set([
  'goal.useCases', 'budget.payment', 'condition.titles', 'condition.damageTolerance',
  'sourcing.geoFlexible', 'logistics.transport', 'logistics.finalDestination',
  'logistics.titleHelp', 'contact.heardFrom', 'vehicle.features',
]);

const scheduleRerender = debounce(() => render(false), 90);

/* -------------------------------------------------------------- draft ---- */
const saveDraft = debounce(() => {
  // Nothing typed yet means there is no draft — otherwise a plain reload would
  // greet the next visitor with "we found your saved answers".
  if (!state.touched.size) return;
  store.set(DRAFT_KEY, {
    v: SCHEMA_VERSION,
    mode: state.mode,
    stepIndex: state.stepIndex,
    data: state.data,
    startedAt: state.startedAt,
    savedAt: new Date().toISOString(),
  });
  flashSaved();
}, 500);

function flashSaved() {
  const hint = $('#save-hint');
  if (!hint) return;
  hint.classList.add('flash');
  setTimeout(() => hint.classList.remove('flash'), 900);
}

function restoreDraft() {
  const d = store.get(DRAFT_KEY);
  if (!d || d.v !== SCHEMA_VERSION || !d.data) return;
  state.data = { ...makeDefaults(), ...d.data };
  state.mode = d.mode === 'express' ? 'express' : 'full';
  state.startedAt = d.startedAt || state.startedAt;
}

function resetDraft() {
  store.remove(DRAFT_KEY);
  state.data = makeDefaults();
  state.errors = {};
  state.touched = new Set();
  state.submitted = null;
  state.stepIndex = 0;
  state.startedAt = new Date().toISOString();
  render();
}

/* ------------------------------------------------------------- submit ---- */
async function submit() {
  const steps = visibleSteps(state.mode);
  const step = steps[state.stepIndex];
  const errs = validateStep(step, state.data, state.mode);
  if (Object.keys(errs).length) {
    state.errors = errs;
    render(false);
    toast(t('err.fixFields'), 'warn');
    return;
  }

  const btn = $('#submit-btn');
  const restore = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; clear(btn); btn.append(el('span.spinner'), el('span', { text: t('common.loading') })); }

  try {
    const record = buildRecord();
    const envelope = state.advisorKey ? await seal(record, state.advisorKey) : null;
    const payload = envelope || { plaintext: true, ...record };

    const delivery = { relay: false, repo: false };

    if (CONFIG.relayUrl) {
      try {
        await postToRelay(CONFIG.relayUrl, { id: record.id, envelope: payload });
        delivery.relay = true;
      } catch (e) { console.warn('[LSC] relay delivery failed:', e.message); }
    }

    const packed = await packPayload(payload);
    const shareUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}console.html#import=${packed}`;

    state.submitted = { ...record, envelope: payload, shareUrl, delivery, encrypted: Boolean(envelope) };
    // Exposed for automated checks: this is the ciphertext, never the answers.
    window.__lastEnvelope = envelope;
    store.set(`sent.${record.id}`, { id: record.id, at: record.createdAt, delivery });
    store.remove(DRAFT_KEY);
    render();
  } catch (e) {
    console.error(e);
    toast(I18n.lang === 'en'
      ? `Could not send: ${e.message}`
      : `No se pudo enviar: ${e.message}`, 'danger', 6000);
    if (btn) { btn.disabled = false; btn.innerHTML = restore; }
  }
}

function buildRecord() {
  const now = new Date().toISOString();
  return {
    id: uid('LSC-'),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    data: clone(state.data),
    meta: {
      ...(state.data.meta || {}),
      mode: state.mode,
      lang: I18n.lang,
      startedAt: state.startedAt,
      durationSec: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000),
      userAgent: navigator.userAgent.slice(0, 200),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      completeness: completeness(state.data, state.mode),
      headline: headline(state.data, I18n.lang),
      profile: deriveProfile(state.data),
    },
  };
}

/* --------------------------------------------------------------- extras -- */
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = el('div.confetti', { 'aria-hidden': 'true' });
  const colors = ['#e8a33d', '#12b5a5', '#4c8dff', '#d7263d', '#f4b942'];
  for (let i = 0; i < 60; i++) {
    host.append(el('i', {
      style: {
        left: `${Math.random() * 100}%`,
        background: colors[i % colors.length],
        animationDuration: `${2 + Math.random() * 2}s`,
        animationDelay: `${Math.random() * 0.6}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    }));
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 5200);
}

/* Exposed for tests and the advisor "fill on behalf" flow. */
export const _internals = { state, handleChange, goTo, buildRecord, render };
