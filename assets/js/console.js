/* =========================================================================
   LSC · Advisor console
   ---------------------------------------------------------------------------
   The advisor's workspace: unlock the private key, pull sealed records from the
   repository, decrypt them locally, then search, triage, annotate, price and
   export. Everything runs in the browser — no server, no paid service.
   ========================================================================= */

import {
  $, el, clear, icon, I18n, Theme, L, t, deepGet, deepSet, clone, uid,
  createStore, toast, modal, confirmDialog, copyText, downloadBlob, buildToolbar,
  debounce, fmtNumber, fmtDate, fmtRelative, fmtMoney, fuzzyScore,
} from './core.js';
import { db } from './idb.js';
import {
  generateAdvisorKeyPair, wrapPrivateKey, unwrapPrivateKey, seal, open as unseal,
  isEnvelope, unpackPayload,
} from './crypto.js';
import { GitHubRepo, PATHS, GitHubError } from './github.js';
import { CONFIG } from './config.js';
import { STEPS, visibleFields, SCHEMA_VERSION } from './schema.js';
import { renderField } from './fields.js';
import { summarize, headline, deriveProfile } from './summary.js';
import { PIPELINE_STAGES, PRIORITIES, BODY_TYPES, byId, parseLotUrl, isValidVin } from './catalogs.js';
import { DEFAULT_FEES } from './fees.js';
import { calculatorPanel } from './calculator.js';
import {
  toCsv, toLongCsv, toJson, toVCards, toMarkdownAll, toMarkdown, toPlainText,
  toPrintableHtml, toWhatsApp, toICal, exportFilename,
} from './exports.js';
import { barChart, areaChart, statTile, weeklySeries } from './charts.js';

const store = createStore('console');

/* =============================================================== state === */
const S = {
  unlocked: false,
  privateJwk: null,
  publicJwk: null,
  records: new Map(),       // id -> record
  view: 'dashboard',
  detailId: null,
  detailTab: 'profile',
  query: '',
  filters: { stage: 'all', priority: 'all', band: 'all' },
  selection: new Set(),
  sync: { status: 'idle', at: null, message: '' },
  settings: loadSettings(),
  fees: store.get('fees', null) || clone(DEFAULT_FEES),
  repo: null,
};

function loadSettings() {
  return {
    owner: CONFIG.owner, repo: CONFIG.repo, branch: CONFIG.branch,
    token: '', autoSync: true, relayUrl: CONFIG.relayUrl,
    ...(store.get('settings', {}) || {}),
  };
}
function saveSettings() { store.set('settings', S.settings); rebuildRepo(); }
function rebuildRepo() {
  S.repo = new GitHubRepo({
    owner: S.settings.owner, repo: S.settings.repo,
    branch: S.settings.branch, token: S.settings.token || null,
  });
}

let root;

/* ================================================================ boot === */
export async function boot(mount) {
  I18n.init();
  Theme.init();
  root = mount;
  rebuildRepo();
  I18n.onChange(() => paint());

  window.addEventListener('hashchange', handleHash);

  const vault = store.get('vault', null);
  if (!vault) renderSetup();
  else renderLock();
}

/* ============================================================== unlock === */
function renderLock() {
  clear(root);
  const en = I18n.lang === 'en';
  const pass = el('input.input', { type: 'password', autocomplete: 'current-password', id: 'pp' });
  const errBox = el('div.err.hidden', icon('warn'), el('span'));

  const doUnlock = async (e) => {
    e?.preventDefault?.();
    errBox.classList.add('hidden');
    try {
      const vault = store.get('vault');
      S.privateJwk = await unwrapPrivateKey(vault, pass.value);
      S.publicJwk = store.get('publicKey');
      S.unlocked = true;
      await loadLocalRecords();
      handleHash();
      if (S.settings.autoSync && S.settings.token) syncNow({ silent: true });
    } catch {
      errBox.classList.remove('hidden');
      errBox.querySelector('span').textContent = en ? 'Wrong passphrase.' : 'Contraseña incorrecta.';
      pass.select();
    }
  };

  root.append(el('div.lock-screen',
    el('form.card.card-solid.card-pad.lock-card.stack.gap-5', { onsubmit: doUnlock },
      el('div.lock-icon', icon('lock')),
      el('div.text-center.stack.gap-2',
        el('h1', { text: en ? 'Advisor console' : 'Consola del asesor' }),
        el('p.text-muted', {
          text: en ? 'Enter your passphrase to decrypt your clients.'
                   : 'Escribe tu contraseña para descifrar tus clientes.',
        })),
      el('div.field',
        el('label.label', { for: 'pp', text: en ? 'Passphrase' : 'Contraseña' }),
        pass, errBox),
      el('button.btn.btn-primary.btn-lg.btn-block', { type: 'submit' },
        icon('unlock'), el('span', { text: t('common.unlock') })),
      el('div.row.center.gap-3',
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button', onclick: renderSetup,
          text: en ? 'Restore a backup' : 'Restaurar un respaldo',
        }),
        buildToolbar().node),
    )));
  setTimeout(() => pass.focus(), 80);
}

function renderSetup() {
  clear(root);
  const en = I18n.lang === 'en';
  const p1 = el('input.input', { type: 'password', autocomplete: 'new-password' });
  const p2 = el('input.input', { type: 'password', autocomplete: 'new-password' });
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  const msg = el('div.err.hidden', icon('warn'), el('span'));

  const fail = (text) => { msg.classList.remove('hidden'); msg.querySelector('span').textContent = text; };

  const create = async () => {
    msg.classList.add('hidden');
    if (p1.value.length < 10) return fail(en ? 'Use at least 10 characters.' : 'Usa al menos 10 caracteres.');
    if (p1.value !== p2.value) return fail(en ? 'The passphrases do not match.' : 'Las contraseñas no coinciden.');
    const { publicJwk, privateJwk, kid } = await generateAdvisorKeyPair();
    const vault = await wrapPrivateKey(privateJwk, p1.value);
    store.set('vault', vault);
    store.set('publicKey', publicJwk);
    S.privateJwk = privateJwk; S.publicJwk = publicJwk; S.unlocked = true;

    downloadBlob(`lsc-backup-${kid}.json`,
      JSON.stringify({ kind: 'lsc-key-backup', createdAt: new Date().toISOString(), vault, publicKey: publicJwk }, null, 2),
      'application/json');

    await loadLocalRecords();
    paint();
    setTimeout(() => showPublishKeyDialog(), 400);
  };

  const restore = async (file) => {
    msg.classList.add('hidden');
    try {
      const parsed = JSON.parse(await file.text());
      const vault = parsed.vault || parsed;
      if (!vault?.ct || !vault?.salt) throw new Error('bad');
      store.set('vault', vault);
      if (parsed.publicKey) store.set('publicKey', parsed.publicKey);
      toast(en ? 'Backup restored — now unlock it.' : 'Respaldo restaurado: ahora desbloquéalo.', 'ok');
      renderLock();
    } catch {
      fail(en ? 'That file is not a valid LSC backup.' : 'Ese archivo no es un respaldo válido de LSC.');
    }
  };
  fileInput.addEventListener('change', () => fileInput.files[0] && restore(fileInput.files[0]));

  root.append(el('div.lock-screen',
    el('div.card.card-solid.card-pad.lock-card.stack.gap-5',
      el('div.lock-icon', icon('key')),
      el('div.text-center.stack.gap-2',
        el('h1', { text: en ? 'Set up your console' : 'Configura tu consola' }),
        el('p.text-muted', {
          text: en
            ? 'We generate a key pair in this browser. The public half seals what clients send you; the private half never leaves this device.'
            : 'Generamos un par de claves en este navegador. La mitad pública sella lo que te envían los clientes; la privada nunca sale de este dispositivo.',
        })),
      el('div.callout.callout-warn', el('span.ci', { text: '⚠️' }),
        el('div', { text: en
          ? 'Keep the backup file and remember the passphrase. Without them, encrypted records cannot be recovered — by anyone, including us.'
          : 'Guarda el archivo de respaldo y recuerda la contraseña. Sin ellos, los registros cifrados no se pueden recuperar — por nadie, ni por nosotros.' })),
      el('div.field',
        el('label.label', { text: en ? 'Passphrase (min. 10 characters)' : 'Contraseña (mín. 10 caracteres)' }), p1),
      el('div.field',
        el('label.label', { text: en ? 'Repeat the passphrase' : 'Repite la contraseña' }), p2),
      msg,
      el('button.btn.btn-primary.btn-lg.btn-block', { type: 'button', onclick: create },
        icon('key'), el('span', { text: en ? 'Create keys and continue' : 'Crear claves y continuar' })),
      el('div.divider'),
      el('div.row.center.gap-3.wrap',
        el('button.btn.btn-outline.btn-sm', { type: 'button', onclick: () => fileInput.click() },
          icon('upload'), el('span', { text: en ? 'Restore backup' : 'Restaurar respaldo' })),
        store.get('vault') ? el('button.btn.btn-ghost.btn-sm', {
          type: 'button', onclick: renderLock, text: en ? 'I already have keys' : 'Ya tengo claves',
        }) : null,
        buildToolbar().node),
      fileInput,
    )));
}

function showPublishKeyDialog() {
  const en = I18n.lang === 'en';
  modal({
    title: en ? 'Publish your public key' : 'Publica tu clave pública',
    size: 'lg',
    body: el('div.stack.gap-4',
      el('p', { text: en
        ? 'The intake form needs your PUBLIC key to seal submissions. Commit it to your repository at data/config/advisor-key.json. It is safe to publish — it can only encrypt, never decrypt.'
        : 'El formulario necesita tu clave PÚBLICA para sellar los envíos. Publícala en tu repositorio en data/config/advisor-key.json. Es seguro publicarla: solo puede cifrar, nunca descifrar.' }),
      el('div.key-blob', { text: JSON.stringify(S.publicJwk, null, 2) }),
      el('div.row.gap-2.wrap',
        el('button.btn.btn-sm', {
          type: 'button',
          onclick: async () => { await copyText(JSON.stringify(S.publicJwk, null, 2)); toast(t('common.copied'), 'ok'); },
        }, icon('copy'), el('span', { text: t('common.copy') })),
        el('button.btn.btn-sm', {
          type: 'button',
          onclick: () => downloadBlob('advisor-key.json', JSON.stringify(S.publicJwk, null, 2), 'application/json'),
        }, icon('download'), el('span', { text: t('common.download') })),
        el('button.btn.btn-sm.btn-primary', {
          type: 'button',
          onclick: async (e) => {
            if (!S.repo?.canWrite) { toast(en ? 'Add a GitHub token in Settings first.' : 'Añade un token de GitHub en Ajustes.', 'warn'); return; }
            e.target.disabled = true;
            try {
              await S.repo.putJson(PATHS.advisorKey, S.publicJwk, { message: 'chore(keys): publish advisor public key' });
              toast(en ? 'Published to the repository.' : 'Publicada en el repositorio.', 'ok');
            } catch (err) { toast(String(err.message), 'danger', 6000); }
            e.target.disabled = false;
          },
        }, icon('cloud'), el('span', { text: en ? 'Publish to repo' : 'Publicar en el repo' })),
      )),
    actions: [{ label: t('common.close'), variant: 'ghost' }],
  });
}

/* ============================================================== records == */
async function loadLocalRecords() {
  S.records.clear();
  try {
    const all = await db.all('records');
    for (const r of all) if (r?.id) S.records.set(r.id, r);
  } catch (e) { console.warn('[LSC] local load failed', e); }
}

async function persist(record) {
  record.crm = record.crm || defaultCrm();
  record.crm.updatedAt = new Date().toISOString();
  S.records.set(record.id, record);
  await db.set('records', record.id, record);
}

const defaultCrm = () => ({
  stage: 'new', priority: 'warm', tags: [], notes: [], sessions: [], lots: [],
  updatedAt: new Date().toISOString(), dirty: true,
});

function markDirty(record) { record.crm.dirty = true; }

/* ================================================================ sync === */
async function syncNow({ silent = false } = {}) {
  if (!S.repo?.configured) { if (!silent) toast('Repo no configurado', 'warn'); return; }
  setSync('busy', I18n.lang === 'en' ? 'Syncing…' : 'Sincronizando…');
  let pulled = 0, pushed = 0;
  try {
    /* ---- pull ---------------------------------------------------------- */
    let names = [];
    if (S.repo.token) {
      names = (await S.repo.listDir(PATHS.submissions)).filter((f) => f.name.endsWith('.json')).map((f) => f.name);
    } else {
      const index = await S.repo.readJson(PATHS.index, { records: [] });
      names = (index.records || []).map((r) => `${r.id}.json`);
    }
    for (const name of names) {
      const id = name.replace(/\.json$/, '');
      if (S.records.has(id) && !S.records.get(id).__stub) continue;
      const raw = await S.repo.readJson(`${PATHS.submissions}/${name}`);
      if (!raw) continue;
      const rec = await decryptRecord(raw);
      if (!rec) continue;
      const existing = S.records.get(id);
      rec.crm = existing?.crm || defaultCrm();
      rec.crm.dirty = false;
      await persistQuiet(rec);
      pulled++;
    }
    /* ---- pull CRM overlays --------------------------------------------- */
    if (S.repo.token) {
      const crmFiles = (await S.repo.listDir(PATHS.crm)).filter((f) => f.name.endsWith('.json'));
      for (const f of crmFiles) {
        const id = f.name.replace(/\.json$/, '');
        const rec = S.records.get(id);
        if (!rec || rec.crm?.dirty) continue;
        const raw = await S.repo.readJson(f.path);
        const crm = raw && isEnvelope(raw) ? await unseal(raw, S.privateJwk).catch(() => null) : raw;
        if (crm) { rec.crm = { ...crm, dirty: false }; await persistQuiet(rec); }
      }
    }
    /* ---- push ----------------------------------------------------------- */
    if (S.repo.canWrite) {
      const files = [];
      for (const rec of S.records.values()) {
        if (!rec.crm?.dirty) continue;
        const payload = { ...rec.crm };
        delete payload.dirty;
        const sealed = S.publicJwk ? await seal(payload, S.publicJwk) : payload;
        files.push({ path: PATHS.crmRecord(rec.id), content: JSON.stringify(sealed, null, 2) + '\n' });
        if (rec.__needsUpload && rec.__envelope) {
          files.push({ path: PATHS.submission(rec.id), content: JSON.stringify(rec.__envelope, null, 2) + '\n' });
        }
      }
      if (files.length) {
        await S.repo.commitFiles(files, `chore(crm): sync ${files.length} file(s) from advisor console`);
        for (const rec of S.records.values()) {
          if (rec.crm?.dirty) { rec.crm.dirty = false; rec.__needsUpload = false; await persistQuiet(rec); }
        }
        pushed = files.length;
      }
    }
    setSync('ok', I18n.lang === 'en'
      ? `Synced · ↓${pulled} ↑${pushed}`
      : `Sincronizado · ↓${pulled} ↑${pushed}`);
    if (!silent) toast(I18n.lang === 'en' ? `Sync complete (↓${pulled} ↑${pushed})` : `Sincronización completa (↓${pulled} ↑${pushed})`, 'ok');
    paint();
  } catch (e) {
    const msg = e instanceof GitHubError && e.status === 401
      ? (I18n.lang === 'en' ? 'Invalid or missing token' : 'Token inválido o ausente')
      : e.message;
    setSync('err', msg);
    if (!silent) toast(msg, 'danger', 6000);
  }
}

async function persistQuiet(record) {
  S.records.set(record.id, record);
  await db.set('records', record.id, record);
}

function setSync(status, message) {
  S.sync = { status, message, at: new Date().toISOString() };
  const node = $('.sync-state');
  if (node) {
    node.className = `sync-state ${status === 'busy' ? '' : status}`;
    node.querySelector('span').textContent = message;
  }
}

async function decryptRecord(raw) {
  try {
    if (isEnvelope(raw)) {
      if (!S.privateJwk) return null;
      const rec = await unseal(raw, S.privateJwk);
      return { ...rec, __envelope: raw, encrypted: true };
    }
    if (raw?.plaintext || raw?.data) return { ...raw, encrypted: false };
    return null;
  } catch (e) {
    console.warn('[LSC] could not decrypt a record', e);
    return null;
  }
}

/* =============================================================== router == */
function handleHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('import=')) { importFromHash(hash.slice(7)); return; }
  const [view, id] = hash.split('/');
  S.view = ['dashboard', 'clients', 'kanban', 'client', 'calculator', 'settings'].includes(view) ? view : 'dashboard';
  if (S.view === 'client') S.detailId = id || null;
  paint();
}

const go = (path) => { location.hash = path; };

async function importFromHash(packed) {
  const en = I18n.lang === 'en';
  history.replaceState(null, '', location.pathname + location.search + '#clients');
  if (!S.unlocked) { toast(en ? 'Unlock first, then reopen the link.' : 'Desbloquea primero y vuelve a abrir el enlace.', 'warn', 6000); renderLock(); return; }
  try {
    const payload = await unpackPayload(packed);
    await ingest(payload, { upload: true });
    toast(en ? 'Client request imported.' : 'Solicitud de cliente importada.', 'ok');
  } catch (e) {
    console.error(e);
    toast(en ? 'That link could not be read.' : 'No se pudo leer ese enlace.', 'danger');
  }
  paint();
}

/** Accept a sealed envelope or a raw record, decrypt, store and queue upload. */
async function ingest(payload, { upload = false } = {}) {
  const rec = await decryptRecord(payload);
  if (!rec) throw new Error('UNREADABLE');
  if (!rec.id) rec.id = uid('LSC-');
  const existing = S.records.get(rec.id);
  rec.crm = existing?.crm || defaultCrm();
  rec.crm.dirty = true;
  rec.__needsUpload = upload;
  if (isEnvelope(payload)) rec.__envelope = payload;
  await persist(rec);
  if (upload && S.repo?.canWrite && S.settings.autoSync) syncNow({ silent: true });
  return rec;
}

/* ================================================================ paint == */
function paint() {
  if (!S.unlocked) return;
  clear(root);

  const tools = buildToolbar({ onLang: () => paint(), onTheme: () => paint() });
  const counts = countByStage();
  const en = I18n.lang === 'en';

  const nav = (id, iconName, label, count) => el('button.side-link', {
    type: 'button', 'aria-current': S.view === id || (id === 'clients' && S.view === 'client') ? 'page' : null,
    onclick: () => { go(id); closeSide(); },
  }, icon(iconName), el('span.grow', { text: label }),
     count !== undefined ? el('span.badge.count', { text: String(count) }) : null);

  const side = el('aside.side',
    el('div.brand',
      el('span.brand-mark', icon('gavel')),
      el('span.brand-text',
        el('span.brand-name', { text: 'La Subasta Cubana' }),
        el('span.brand-sub', { text: en ? 'Advisor console' : 'Consola del asesor' }))),
    el('nav.side-nav',
      nav('dashboard', 'chart', en ? 'Dashboard' : 'Panel'),
      nav('clients', 'user', en ? 'Clients' : 'Clientes', S.records.size),
      nav('kanban', 'kanban', en ? 'Pipeline' : 'Embudo', counts.active),
      nav('calculator', 'calc', en ? 'Calculator' : 'Calculadora'),
      nav('settings', 'settings', en ? 'Settings' : 'Ajustes'),
    ),
    el('div.side-foot',
      el('div.sync-state', { class: S.sync.status === 'busy' ? '' : S.sync.status },
        el('span.dot'), el('span', { text: S.sync.message || (en ? 'Not synced yet' : 'Sin sincronizar') })),
      el('button.btn.btn-outline.btn-sm.btn-block', { type: 'button', onclick: () => syncNow() },
        icon('refresh'), el('span', { text: en ? 'Sync now' : 'Sincronizar' })),
      el('button.btn.btn-ghost.btn-sm.btn-block', {
        type: 'button', onclick: () => { S.unlocked = false; S.privateJwk = null; renderLock(); },
      }, icon('lock'), el('span', { text: en ? 'Lock' : 'Bloquear' })),
    ));

  const top = el('div.console-top',
    el('button.btn.btn-ghost.btn-icon.side-toggle', {
      type: 'button', 'aria-label': 'Menu', onclick: toggleSide,
    }, icon('menu')),
    el('div.search-box', icon('search'),
      el('input.input', {
        type: 'search', value: S.query,
        placeholder: en ? 'Search name, phone, car, notes…' : 'Buscar nombre, teléfono, auto, notas…',
        'aria-label': t('common.search'),
        oninput: debounce((e) => { S.query = e.target.value; if (S.view !== 'clients') go('clients'); else renderBody(); }, 180),
      })),
    el('div.grow'),
    el('button.btn.btn-sm', { type: 'button', onclick: openImportDialog },
      icon('upload'), el('span.hide-sm', { text: t('common.import') })),
    el('a.btn.btn-sm.btn-primary', { href: 'index.html?advisor=1', target: '_blank', rel: 'noopener' },
      icon('plus'), el('span.hide-sm', { text: en ? 'New intake' : 'Nuevo levantamiento' })),
    tools.node,
  );

  const main = el('main.console-main', top, el('div.console-body', { id: 'view-body' }));
  root.append(el('div.console-shell', side, main));
  renderBody();
}

const toggleSide = () => {
  const side = $('.side');
  side.classList.toggle('open');
  if (side.classList.contains('open')) {
    root.append(el('div.side-scrim', { onclick: closeSide }));
  } else closeSide();
};
const closeSide = () => { $('.side')?.classList.remove('open'); $('.side-scrim')?.remove(); };

function renderBody() {
  const body = $('#view-body');
  if (!body) return;
  clear(body);
  const views = {
    dashboard: viewDashboard, clients: viewClients, kanban: viewKanban,
    client: viewClient, calculator: viewCalculator, settings: viewSettings,
  };
  body.append((views[S.view] || viewDashboard)());
}

/* ============================================================ dashboard == */
function countByStage() {
  const counts = {};
  let active = 0;
  for (const r of S.records.values()) {
    const s = r.crm?.stage || 'new';
    counts[s] = (counts[s] || 0) + 1;
    if (!['won', 'delivered', 'lost'].includes(s)) active++;
  }
  return { ...counts, active };
}

function viewDashboard() {
  const en = I18n.lang === 'en';
  const all = [...S.records.values()];
  const wrap = el('section');

  wrap.append(el('div.page-head',
    el('div',
      el('h1', { text: en ? 'Dashboard' : 'Panel' }),
      el('p', { text: en ? 'Your portfolio at a glance.' : 'Tu cartera de un vistazo.' })),
    el('div.row.gap-2.wrap',
      el('button.btn.btn-sm', { type: 'button', onclick: () => exportMenu(all) },
        icon('download'), el('span', { text: t('common.export') })))));

  if (!all.length) {
    wrap.append(emptyState(
      en ? 'No clients yet' : 'Aún no hay clientes',
      en ? 'Share your intake link, or import a request a client sent you.'
         : 'Comparte tu enlace de formulario, o importa una solicitud que te enviaron.',
      [
        el('button.btn.btn-primary', { type: 'button', onclick: shareLinkDialog },
          icon('link'), el('span', { text: en ? 'Share intake link' : 'Compartir enlace' })),
        el('button.btn', { type: 'button', onclick: openImportDialog },
          icon('upload'), el('span', { text: t('common.import') })),
      ]));
    return wrap;
  }

  const now = Date.now();
  const week = all.filter((r) => now - new Date(r.createdAt).getTime() < 7 * 86400000);
  const budgets = all.map((r) => Number(deepGet(r.data, 'budget.total')) || 0).filter(Boolean);
  const avg = budgets.length ? budgets.reduce((a, b) => a + b, 0) / budgets.length : 0;
  const hot = all.filter((r) => deriveProfile(r.data).heat >= 60);
  const won = all.filter((r) => ['won', 'delivered'].includes(r.crm?.stage));

  wrap.append(el('div.stat-grid',
    statTile({ label: en ? 'Total clients' : 'Clientes totales', value: fmtNumber(all.length, I18n.lang) }),
    statTile({ label: en ? 'New this week' : 'Nuevos esta semana', value: fmtNumber(week.length, I18n.lang), tone: 'brand' }),
    statTile({ label: en ? 'Hot leads' : 'Leads calientes', value: fmtNumber(hot.length, I18n.lang), tone: 'warn',
      hint: en ? 'High urgency + budget' : 'Urgencia y presupuesto altos' }),
    statTile({ label: en ? 'Average budget' : 'Presupuesto medio', value: fmtMoney(avg, { lang: I18n.lang, compact: avg > 99999 }) }),
    statTile({ label: en ? 'Won' : 'Ganados', value: fmtNumber(won.length, I18n.lang), tone: 'ok' }),
  ));

  const stageRows = PIPELINE_STAGES.map((s) => ({
    label: `${s.emoji} ${L(s.label)}`,
    value: all.filter((r) => (r.crm?.stage || 'new') === s.id).length,
  }));

  const bands = [
    ['budget', en ? 'Under $5k' : 'Menos de $5k'],
    ['entry', '$5k – $12k'],
    ['mid', '$12k – $25k'],
    ['premium', en ? 'Over $25k' : 'Más de $25k'],
  ].map(([id, label]) => ({
    label, value: all.filter((r) => deriveProfile(r.data).budgetBand === id).length,
  }));

  const bodyCounts = {};
  for (const r of all) for (const b of deepGet(r.data, 'vehicle.bodyTypes') || []) bodyCounts[b] = (bodyCounts[b] || 0) + 1;
  const bodyRows = Object.entries(bodyCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([id, value]) => {
      const body = byId(BODY_TYPES, id);
      return { label: body ? `${body.emoji} ${L(body.label)}` : id, value };
    });

  wrap.append(el('div.chart-grid',
    card(en ? 'Pipeline' : 'Embudo', barChart(stageRows)),
    card(en ? 'Requests per week' : 'Solicitudes por semana',
      areaChart(weeklySeries(all.map((r) => r.createdAt)), { label: en ? 'Requests per week' : 'Solicitudes por semana' })),
    card(en ? 'Budget distribution' : 'Distribución de presupuesto', barChart(bands)),
    bodyRows.length ? card(en ? 'Most requested body types' : 'Carrocerías más pedidas', barChart(bodyRows)) : null,
  ));

  const recent = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  wrap.append(el('h3', { style: { marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' },
    text: en ? 'Latest requests' : 'Últimas solicitudes' }));
  wrap.append(el('div.client-grid', ...recent.map(clientCard)));
  return wrap;
}

const card = (title, content) => el('div.card.card-solid',
  el('div.card-head', el('strong', { text: title })),
  el('div.card-body', content));

function emptyState(title, text, actions = []) {
  return el('div.empty',
    el('span.big', { text: '🗂️' }),
    el('h3', { text: title }),
    el('p', { text }),
    actions.length ? el('div.row.gap-3.wrap.center', ...actions) : null);
}

/* ============================================================== clients == */
function matchesQuery(record, q) {
  if (!q) return 1;
  const d = record.data || {};
  const hay = [
    record.id,
    deepGet(d, 'contact.fullName'), deepGet(d, 'contact.phone'), deepGet(d, 'contact.email'),
    deepGet(d, 'contact.city'), deepGet(d, 'contact.state'),
    headline(d, I18n.lang),
    (deepGet(d, 'vehicle.makes') || []).join(' '),
    (deepGet(d, 'vehicle.models') || []).join(' '),
    deepGet(d, 'references.notes'),
    (record.crm?.tags || []).join(' '),
    (record.crm?.notes || []).map((n) => n.text).join(' '),
  ].filter(Boolean).join(' · ');
  return fuzzyScore(q, hay);
}

function filteredRecords() {
  const q = S.query.trim();
  return [...S.records.values()]
    .map((r) => ({ r, score: matchesQuery(r, q) }))
    .filter(({ r, score }) => {
      if (score <= 0) return false;
      const crm = r.crm || {};
      if (S.filters.stage !== 'all' && (crm.stage || 'new') !== S.filters.stage) return false;
      if (S.filters.priority !== 'all' && (crm.priority || 'warm') !== S.filters.priority) return false;
      if (S.filters.band !== 'all' && deriveProfile(r.data).budgetBand !== S.filters.band) return false;
      return true;
    })
    .sort((a, b) => (b.score - a.score) || (new Date(b.r.createdAt) - new Date(a.r.createdAt)))
    .map(({ r }) => r);
}

function viewClients() {
  const en = I18n.lang === 'en';
  const rows = filteredRecords();
  const wrap = el('section');

  wrap.append(el('div.page-head',
    el('div',
      el('h1', { text: en ? 'Clients' : 'Clientes' }),
      el('p', { text: `${rows.length} ${en ? 'of' : 'de'} ${S.records.size}` })),
    el('div.list-toolbar',
      el('button.btn.btn-sm', { type: 'button', onclick: shareLinkDialog },
        icon('link'), el('span', { text: en ? 'Intake link' : 'Enlace del formulario' })),
      el('button.btn.btn-sm', { type: 'button', onclick: () => exportMenu(rows) },
        icon('download'), el('span', { text: t('common.export') })))));

  wrap.append(el('div.filters-row',
    filterSelect('stage', en ? 'Stage' : 'Etapa',
      [{ id: 'all', label: t('common.all') }, ...PIPELINE_STAGES]),
    filterSelect('priority', en ? 'Priority' : 'Prioridad',
      [{ id: 'all', label: t('common.all') }, ...PRIORITIES]),
    filterSelect('band', en ? 'Budget' : 'Presupuesto', [
      { id: 'all', label: t('common.all') },
      { id: 'budget', label: '< $5k' }, { id: 'entry', label: '$5k–12k' },
      { id: 'mid', label: '$12k–25k' }, { id: 'premium', label: '> $25k' },
    ]),
    (S.filters.stage !== 'all' || S.filters.priority !== 'all' || S.filters.band !== 'all' || S.query)
      ? el('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          onclick: () => { S.filters = { stage: 'all', priority: 'all', band: 'all' }; S.query = ''; paint(); },
        }, icon('x'), el('span', { text: t('common.clear') })) : null,
  ));

  if (!rows.length) {
    wrap.append(emptyState(
      en ? 'Nothing matches' : 'Sin resultados',
      en ? 'Try a different search or clear the filters.' : 'Prueba otra búsqueda o limpia los filtros.'));
    return wrap;
  }

  wrap.append(el('div.client-grid', ...rows.map(clientCard)));

  if (S.selection.size) {
    wrap.append(el('div.selection-bar',
      el('strong', { text: `${S.selection.size} ${en ? 'selected' : 'seleccionados'}` }),
      el('div.grow'),
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: () => exportMenu(rows.filter((r) => S.selection.has(r.id))),
      }, icon('download'), el('span', { text: t('common.export') })),
      el('button.btn.btn-sm.btn-danger', { type: 'button', onclick: deleteSelected },
        icon('trash'), el('span', { text: t('common.delete') })),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: () => { S.selection.clear(); renderBody(); },
        text: t('common.cancel'),
      })));
  }
  return wrap;
}

function filterSelect(key, label, options) {
  const sel = el('select.select', {
    'aria-label': label, style: { width: 'auto', minWidth: '150px', minHeight: '38px', padding: '6px 34px 6px 12px' },
    onchange: (e) => { S.filters[key] = e.target.value; renderBody(); },
  });
  for (const o of options) sel.append(el('option', { value: o.id, text: L(o.label), selected: S.filters[key] === o.id }));
  return sel;
}

function clientCard(record) {
  const d = record.data || {};
  const crm = record.crm || {};
  const stage = byId(PIPELINE_STAGES, crm.stage || 'new');
  const prio = byId(PRIORITIES, crm.priority || 'warm');
  const profile = deriveProfile(d);
  const name = deepGet(d, 'contact.fullName') || record.id;
  const selected = S.selection.has(record.id);

  return el(`div.client-card${selected ? '.selected' : ''}`, {
    role: 'button', tabindex: '0',
    onclick: (e) => { if (e.metaKey || e.ctrlKey) { toggleSelect(record.id); return; } go(`client/${record.id}`); },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(`client/${record.id}`); } },
  },
    el('div.cc-top',
      el('div.avatar', { text: initials(name), 'aria-hidden': 'true' }),
      el('div.grow.stack.gap-1',
        el('span.cc-name', { text: name }),
        el('span.cc-sub', { text: headline(d, I18n.lang) })),
      el('label.row', { onclick: (e) => e.stopPropagation(), style: { cursor: 'pointer' } },
        el('input', {
          type: 'checkbox', checked: selected,
          'aria-label': `${t('common.select')} ${name}`,
          onchange: () => toggleSelect(record.id),
        }))),
    el('div.cc-meta',
      stage ? el('span.badge', { class: `badge-${stage.color}` }, el('span.dot'), el('span', { text: L(stage.label) })) : null,
      prio ? el('span.badge', { text: `${prio.emoji} ${L(prio.label)}` }) : null,
      ...(crm.tags || []).slice(0, 2).map((tg) => el('span.badge', { text: tg })),
      record.encrypted === false ? el('span.badge.badge-warn', { text: '⚠︎ sin cifrar' }) : null),
    el('div.heat-bar', el('i', { style: { width: `${profile.heat}%` } })),
    el('div.row.between.text-xs.text-subtle',
      el('span', { text: fmtRelative(record.createdAt, I18n.lang) }),
      el('span.mono', { text: record.id.slice(-6) })),
  );
}

const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

function toggleSelect(id) {
  if (S.selection.has(id)) S.selection.delete(id); else S.selection.add(id);
  renderBody();
}

async function deleteSelected() {
  const en = I18n.lang === 'en';
  const ok = await confirmDialog({
    title: en ? 'Delete selected clients?' : '¿Eliminar los clientes seleccionados?',
    message: en
      ? `${S.selection.size} record(s) will be removed from this device. Files already in the repository stay there unless you also delete them from GitHub.`
      : `Se eliminarán ${S.selection.size} registro(s) de este dispositivo. Los archivos ya subidos al repositorio se mantienen salvo que también los borres en GitHub.`,
    danger: true,
  });
  if (!ok) return;
  for (const id of S.selection) { S.records.delete(id); await db.del('records', id); }
  S.selection.clear();
  renderBody();
}

/* =============================================================== kanban == */
function viewKanban() {
  const en = I18n.lang === 'en';
  const wrap = el('section');
  wrap.append(el('div.page-head',
    el('div',
      el('h1', { text: en ? 'Pipeline' : 'Embudo' }),
      el('p', { text: en ? 'Drag a card to move the client along.' : 'Arrastra una tarjeta para mover al cliente.' }))));

  const board = el('div.kanban');
  for (const stage of PIPELINE_STAGES) {
    const items = [...S.records.values()].filter((r) => (r.crm?.stage || 'new') === stage.id);
    const col = el('div.kan-col', { dataset: { stage: stage.id } },
      el('div.kan-head',
        el('strong', { text: `${stage.emoji} ${L(stage.label)}` }),
        el('span.badge', { text: String(items.length) })));

    for (const r of items) {
      const name = deepGet(r.data, 'contact.fullName') || r.id;
      const cardNode = el('div.kan-card', {
        draggable: 'true', dataset: { id: r.id },
        onclick: () => go(`client/${r.id}`),
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', r.id); cardNode.classList.add('dragging'); },
        ondragend: () => cardNode.classList.remove('dragging'),
      },
        el('span.kc-name', { text: name }),
        el('span.kc-sub', { text: headline(r.data, I18n.lang) }),
        el('div.row.gap-2.wrap',
          el('span.badge', { text: fmtMoney(deepGet(r.data, 'budget.total') || 0, { lang: I18n.lang, compact: true }) }),
          el('span.badge', { text: fmtRelative(r.createdAt, I18n.lang) })));
      col.append(cardNode);
    }

    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const rec = S.records.get(id);
      if (!rec || rec.crm.stage === stage.id) return;
      rec.crm.stage = stage.id;
      markDirty(rec);
      await persist(rec);
      renderBody();
      if (S.settings.autoSync && S.repo?.canWrite) syncNow({ silent: true });
    });
    board.append(col);
  }
  wrap.append(board);
  return wrap;
}

/* =============================================================== detail == */
function viewClient() {
  const en = I18n.lang === 'en';
  const rec = S.records.get(S.detailId);
  if (!rec) return emptyState(en ? 'Client not found' : 'Cliente no encontrado', '');

  const d = rec.data || {};
  const name = deepGet(d, 'contact.fullName') || rec.id;
  const phone = deepGet(d, 'contact.phone');
  const email = deepGet(d, 'contact.email');
  const profile = deriveProfile(d);

  const wrap = el('section');
  wrap.append(el('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => go('clients') },
    icon('arrowLeft'), el('span', { text: en ? 'All clients' : 'Todos los clientes' })));

  wrap.append(el('div.detail-head',
    el('div.avatar', { text: initials(name) }),
    el('div.grow.stack.gap-2',
      el('h1', { text: name }),
      el('p.text-muted', { text: headline(d, I18n.lang) }),
      el('div.row.gap-2.wrap',
        el('span.badge.mono', { text: rec.id }),
        el('span.badge', { text: fmtDate(rec.createdAt, I18n.lang, { dateStyle: 'medium', timeStyle: 'short' }) }),
        el('span.badge', { text: `🔥 ${profile.heat}` }),
        rec.encrypted ? el('span.badge.badge-ok', { text: '🔒 E2E' }) : el('span.badge.badge-warn', { text: en ? '⚠︎ plain' : '⚠︎ sin cifrar' }))),
    el('div.row.gap-2.wrap',
      phone ? el('a.btn.btn-sm.btn-primary', {
        href: `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(waGreeting(rec))}`,
        target: '_blank', rel: 'noopener',
      }, icon('whatsapp'), el('span', { text: 'WhatsApp' })) : null,
      phone ? el('a.btn.btn-sm', { href: `tel:${String(phone).replace(/[^\d+]/g, '')}` }, icon('clock'), el('span', { text: en ? 'Call' : 'Llamar' })) : null,
      email ? el('a.btn.btn-sm', { href: `mailto:${email}` }, icon('mail'), el('span', { text: en ? 'Email' : 'Correo' })) : null,
      el('button.btn.btn-sm', { type: 'button', onclick: () => exportMenu([rec]) },
        icon('download'), el('span', { text: t('common.export') })),
    )));

  const tabs = [
    ['profile', en ? 'Profile' : 'Perfil', 'user'],
    ['requirements', en ? 'Requirements' : 'Requisitos', 'file'],
    ['pipeline', en ? 'Pipeline & notes' : 'Embudo y notas', 'kanban'],
    ['lots', en ? 'Target lots' : 'Lotes objetivo', 'gavel'],
    ['costs', en ? 'Cost plan' : 'Plan de costos', 'calc'],
  ];
  const tabBar = el('div.tabs', { role: 'tablist' });
  for (const [id, label, ico] of tabs) {
    tabBar.append(el('button.tab', {
      type: 'button', role: 'tab', 'aria-selected': String(S.detailTab === id),
      onclick: () => { S.detailTab = id; renderBody(); },
    }, icon(ico), el('span', { text: label })));
  }
  wrap.append(tabBar);

  const panels = {
    profile: () => tabProfile(rec),
    requirements: () => tabRequirements(rec),
    pipeline: () => tabPipeline(rec),
    lots: () => tabLots(rec),
    costs: () => tabCosts(rec),
  };
  wrap.append(el('div', { role: 'tabpanel' }, (panels[S.detailTab] || panels.profile)()));
  return wrap;
}

const waGreeting = (rec) => {
  const en = I18n.lang === 'en';
  const first = String(deepGet(rec.data, 'contact.fullName') || '').split(/\s+/)[0] || '';
  return en
    ? `Hi ${first}! This is your advisor at La Subasta Cubana. I reviewed your request (${rec.id}) and I have options for you.`
    : `¡Hola ${first}! Soy tu asesor de La Subasta Cubana. Revisé tu solicitud (${rec.id}) y tengo opciones para ti.`;
};

function tabProfile(rec) {
  const en = I18n.lang === 'en';
  const d = rec.data;
  const p = deriveProfile(d);
  const box = el('div.stack.gap-5');

  box.append(el('div.stat-grid',
    statTile({ label: en ? 'Budget' : 'Presupuesto', value: fmtMoney(deepGet(d, 'budget.total') || 0, { lang: I18n.lang }) }),
    statTile({
      label: en ? 'Risk appetite' : 'Tolerancia al riesgo',
      value: { low: en ? 'Low' : 'Baja', medium: en ? 'Medium' : 'Media', high: en ? 'High' : 'Alta' }[p.riskAppetite],
      tone: p.riskAppetite === 'high' ? 'warn' : p.riskAppetite === 'low' ? 'ok' : '',
    }),
    statTile({ label: en ? 'Experience' : 'Experiencia', value: { none: en ? 'First time' : 'Primera vez', some: en ? 'Some' : 'Algo', expert: en ? 'Experienced' : 'Con experiencia' }[p.experience] }),
    statTile({ label: en ? 'Lead heat' : 'Temperatura', value: `${p.heat}`, tone: p.heat >= 60 ? 'warn' : '' }),
  ));

  const flags = [];
  if (p.needsEducation) flags.push(en ? 'Needs a walkthrough of how auctions work' : 'Necesita que le expliques cómo funciona la subasta');
  if (p.isExport) flags.push(en ? 'Export case — quote ocean freight and customs' : 'Caso de exportación: cotiza naviera y aduana');
  if (p.isRideshare) flags.push(en ? 'Rideshare — check Uber/Lyft age and title rules' : 'Rideshare: revisa reglas de edad y título de Uber/Lyft');
  if (p.isResale) flags.push(en ? 'Resale buyer — margin matters more than comfort' : 'Compra para revender: importa el margen más que el confort');
  if (deepGet(d, 'condition.sightUnseen') === 'inspection') flags.push(en ? 'Wants an on-site inspection before bidding' : 'Quiere inspección presencial antes de pujar');
  if (deepGet(d, 'budget.depositReady') === 'explain') flags.push(en ? 'Deposit needs explaining' : 'Hay que explicarle el depósito');

  if (flags.length) {
    box.append(card(en ? 'Advisor cues' : 'Claves para la asesoría',
      el('ul.stack.gap-2', ...flags.map((f) => el('li.row.gap-2', el('span', { text: '→' }), el('span', { text: f }))))));
  }

  for (const g of summarize(d, I18n.lang).slice(0, 3)) box.append(summaryCard(g));
  return box;
}

function summaryCard(group) {
  const list = el('dl.summary-list');
  for (const it of group.items) {
    list.append(el('div.summary-item', el('dt', { text: it.label }), el('dd', { text: it.value })));
  }
  return card(`${group.emoji} ${group.title}`, list);
}

function tabRequirements(rec) {
  const en = I18n.lang === 'en';
  const box = el('div.stack.gap-4');
  box.append(el('div.row.between.wrap.gap-3',
    el('p.text-muted', { text: en ? 'Everything the client answered. Edit anything that changed during the call.' : 'Todo lo que respondió el cliente. Edita lo que haya cambiado durante la llamada.' }),
    el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: () => openEditor(rec) },
      icon('edit'), el('span', { text: en ? 'Edit answers' : 'Editar respuestas' }))));
  for (const g of summarize(rec.data, I18n.lang)) box.append(summaryCard(g));
  return box;
}

function tabPipeline(rec) {
  const en = I18n.lang === 'en';
  const crm = rec.crm;
  const box = el('div.stack.gap-5');

  const save = async () => { markDirty(rec); await persist(rec); };

  const stageSel = el('select.select', {
    'aria-label': en ? 'Stage' : 'Etapa',
    onchange: async (e) => { crm.stage = e.target.value; await save(); toast(t('common.save'), 'ok', 1200); },
  });
  for (const st of PIPELINE_STAGES) {
    stageSel.append(el('option', { value: st.id, text: `${st.emoji} ${L(st.label)}`, selected: (crm.stage || 'new') === st.id }));
  }

  const prioSel = el('select.select', {
    'aria-label': en ? 'Priority' : 'Prioridad',
    onchange: async (e) => { crm.priority = e.target.value; await save(); },
  });
  for (const pr of PRIORITIES) {
    prioSel.append(el('option', { value: pr.id, text: `${pr.emoji} ${L(pr.label)}`, selected: (crm.priority || 'warm') === pr.id }));
  }

  /* ---- tags: repaint only the chip list, never the whole panel, so an
          in-progress note in the textarea below is never discarded. ------- */
  const tagList = el('div.chips');
  const paintTags = () => {
    clear(tagList);
    crm.tags.forEach((tg, i) => {
      tagList.append(el('span.tag',
        el('span', { text: tg }),
        el('button', {
          type: 'button', text: '×', 'aria-label': `${t('common.remove')} ${tg}`,
          onclick: async () => { crm.tags.splice(i, 1); await save(); paintTags(); },
        })));
    });
  };
  paintTags();

  const tagInput = el('input.input', {
    placeholder: en ? 'Add a tag and press Enter' : 'Añade una etiqueta y pulsa Enter',
    'aria-label': en ? 'Tags' : 'Etiquetas',
    onkeydown: async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim();
      e.target.value = '';
      if (!v || crm.tags.includes(v)) return;
      crm.tags.push(v);
      await save();
      paintTags();
    },
  });

  box.append(card(en ? 'Status' : 'Estado', el('div.stack.gap-4',
    el('div.field-row',
      el('div.field', el('label.label', { text: en ? 'Stage' : 'Etapa' }), stageSel),
      el('div.field', el('label.label', { text: en ? 'Priority' : 'Prioridad' }), prioSel)),
    el('div.field', el('label.label', { text: en ? 'Tags' : 'Etiquetas' }), tagInput, tagList))));

  /* ---- activity log ------------------------------------------------------ */
  const noteBox = el('textarea.textarea', {
    placeholder: en ? 'What happened in this conversation?' : '¿Qué pasó en esta conversación?',
    rows: 3,
    'aria-label': en ? 'New entry' : 'Nueva entrada',
  });
  const kindSel = el('select.select', {
    style: { maxWidth: '190px' },
    'aria-label': en ? 'Entry type' : 'Tipo de entrada',
  });
  for (const [id, label] of [
    ['note', en ? 'Note' : 'Nota'], ['call', en ? 'Call' : 'Llamada'],
    ['meeting', en ? 'Advisory session' : 'Sesión de asesoría'], ['offer', en ? 'Offer sent' : 'Oferta enviada'],
  ]) kindSel.append(el('option', { value: id, text: label }));

  const notesList = el('div.stack.gap-3');
  const paintNotes = () => {
    clear(notesList);
    if (!crm.notes.length) {
      notesList.append(el('p.text-subtle.text-sm', { text: en ? 'No entries yet.' : 'Aún no hay entradas.' }));
      return;
    }
    crm.notes.forEach((n, i) => {
      notesList.append(el('div.note-item',
        el('div.nt-meta',
          el('strong', { text: { note: '📝', call: '📞', meeting: '🎥', offer: '📤' }[n.kind] || '📝' }),
          el('span', { text: fmtDate(n.at, I18n.lang, { dateStyle: 'medium', timeStyle: 'short' }) }),
          el('div.grow'),
          el('button.btn.btn-ghost.btn-sm', {
            type: 'button', 'aria-label': t('common.delete'),
            onclick: async () => { crm.notes.splice(i, 1); await save(); paintNotes(); },
          }, icon('trash'))),
        el('div.nt-body', { text: n.text })));
    });
  };
  paintNotes();

  const addNote = async () => {
    const text = noteBox.value.trim();
    if (!text) return;
    crm.notes.unshift({ id: uid('N-'), at: new Date().toISOString(), kind: kindSel.value, text });
    noteBox.value = '';
    await save();
    paintNotes();
  };

  box.append(card(en ? 'Activity log' : 'Bitácora', el('div.stack.gap-4',
    el('div.stack.gap-3', noteBox,
      el('div.row.gap-2.wrap', kindSel,
        el('button.btn.btn-primary.btn-sm', { type: 'button', onclick: addNote },
          icon('plus'), el('span', { text: en ? 'Add entry' : 'Añadir entrada' })))),
    notesList)));

  return box;
}

function tabLots(rec) {
  const en = I18n.lang === 'en';
  const crm = rec.crm;
  const box = el('div.stack.gap-5');

  const urlIn = el('input.input', { placeholder: 'https://www.copart.com/lot/…' });
  const bidIn = el('input.input', { type: 'number', placeholder: en ? 'Max bid $' : 'Puja máxima $', min: 0, step: 25 });
  const noteIn = el('input.input', { placeholder: en ? 'Why this one?' : '¿Por qué este?' });

  const addLot = async () => {
    const url = urlIn.value.trim();
    if (!url) return;
    const parsed = parseLotUrl(url) || {};
    crm.lots.unshift({
      id: uid('L-'), at: new Date().toISOString(), url,
      source: parsed.source || null, lot: parsed.lot || null,
      vin: parsed.vin && isValidVin(parsed.vin) ? parsed.vin : (parsed.vin || null),
      maxBid: Number(bidIn.value) || null, note: noteIn.value.trim(), status: 'watching',
    });
    markDirty(rec); await persist(rec); renderBody();
  };

  box.append(card(en ? 'Add a lot' : 'Añadir un lote', el('div.stack.gap-3',
    urlIn,
    el('div.field-row', bidIn, noteIn),
    el('div', el('button.btn.btn-primary.btn-sm', { type: 'button', onclick: addLot },
      icon('plus'), el('span', { text: t('common.add') }))))));

  const clientLots = deepGet(rec.data, 'references.lots') || [];
  if (clientLots.length) {
    box.append(card(en ? 'Lots the client sent' : 'Lotes que envió el cliente',
      el('div.stack.gap-3', ...clientLots.map((l) => el('div.lot-card',
        el('span', { text: '🔗' }),
        el('div.grow.stack.gap-1',
          el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.url }),
          l.note ? el('span.text-sm.text-muted', { text: l.note }) : null))))));
  }

  box.append(card(en ? 'Your shortlist' : 'Tu selección',
    crm.lots.length ? el('div.stack.gap-3', ...crm.lots.map((l, i) => el('div.lot-card',
      el('span', { text: { copart: '🔨', iaai: '🏢', manheim: '🏁', acv: '📱' }[l.source] || '🔗' }),
      el('div.grow.stack.gap-1',
        el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.url }),
        el('div.row.gap-2.wrap',
          l.lot ? el('span.badge', { text: `Lot ${l.lot}` }) : null,
          l.vin ? el('span.badge.mono', { text: l.vin }) : null,
          l.maxBid ? el('span.badge.badge-brand', { text: `${en ? 'Max' : 'Máx'} ${fmtMoney(l.maxBid, { lang: I18n.lang })}` }) : null,
          el('span.badge', { text: fmtRelative(l.at, I18n.lang) })),
        l.note ? el('span.text-sm.text-muted', { text: l.note }) : null),
      el('button.btn.btn-ghost.btn-icon.btn-sm', {
        type: 'button', 'aria-label': t('common.delete'),
        onclick: async () => { crm.lots.splice(i, 1); markDirty(rec); await persist(rec); renderBody(); },
      }, icon('trash')))))
      : el('p.text-subtle.text-sm', { text: en ? 'No lots yet. Paste a Copart, IAA or bid.cars link above.' : 'Aún no hay lotes. Pega arriba un enlace de Copart, IAA o bid.cars.' })));

  box.append(el('div.callout.callout-brand',
    el('span.ci', { text: '🔎' }),
    el('div.stack.gap-2',
      el('strong', { text: en ? 'Research shortcuts' : 'Atajos de investigación' }),
      el('div.row.gap-2.wrap',
        ...researchLinks(rec).map(([label, href]) =>
          el('a.btn.btn-sm', { href, target: '_blank', rel: 'noopener noreferrer' },
            icon('link'), el('span', { text: label })))))));
  return box;
}

function researchLinks(rec) {
  const d = rec.data;
  const make = (deepGet(d, 'vehicle.makes') || [])[0] || '';
  const model = (deepGet(d, 'vehicle.models') || [])[0] || '';
  const q = encodeURIComponent(`${make} ${model}`.trim());
  return [
    ['Copart', `https://www.copart.com/lotSearchResults?free=true&query=${q}`],
    ['IAA', `https://www.iaai.com/Search?Keyword=${q}`],
    ['bid.cars', `https://bid.cars/en/search/archived/results?search-type=filters&type=Automobile&make=${encodeURIComponent(make)}`],
    ['AutoAstat', 'https://autoastat.com/'],
    ['Carfax', 'https://www.carfax.com/'],
    ['Super Dispatch', 'https://super.superdispatch.com/'],
  ];
}

function tabCosts(rec) {
  const en = I18n.lang === 'en';
  const d = rec.data;
  return calculatorPanel({
    budget: Number(deepGet(d, 'budget.total')) || 10000,
    repairBudget: Number(deepGet(d, 'condition.repairBudget')) || 0,
    oversize: (deepGet(d, 'vehicle.bodyTypes') || []).some((b) => ['suv', 'pickup', 'minivan', 'van', 'heavy'].includes(b)),
    nonRunning: deepGet(d, 'condition.runDrive') === 'no',
    exportMode: deepGet(d, 'logistics.exportMode') || 'none',
    miles: deepGet(d, 'logistics.transport') === 'managed' ? 600 : 0,
  }, {
    fees: S.fees,
    onSave: async (text) => {
      rec.crm.notes.unshift({
        id: uid('N-'), at: new Date().toISOString(), kind: 'note',
        text: `${en ? 'Cost plan' : 'Plan de costos'}\n${text}`,
      });
      markDirty(rec);
      await persist(rec);
      toast(en ? 'Saved to the activity log.' : 'Guardado en la bitácora.', 'ok');
    },
  });
}

/* ------------------------------------------------------------- editing --- */
function openEditor(rec) {
  const en = I18n.lang === 'en';
  const draft = clone(rec.data);
  const errors = {};
  const body = el('div.stack.gap-5');

  const rebuild = () => {
    clear(body);
    for (const step of STEPS) {
      const fields = visibleFields(step, draft, 'full').filter((f) => f.type !== 'info');
      if (!fields.length) continue;
      const grid = el('div.fields-grid');
      const ctx = {
        data: draft, errors,
        onChange: (id, value) => {
          deepSet(draft, id, value);
          if (['goal.useCases', 'condition.damageTolerance', 'condition.titles', 'sourcing.geoFlexible',
               'logistics.transport', 'logistics.finalDestination', 'logistics.titleHelp',
               'contact.heardFrom', 'vehicle.features', 'budget.payment'].includes(id)) rebuildSoon();
        },
      };
      for (const f of fields) grid.append(renderField(f, ctx));
      body.append(el('details', { open: ['contact', 'budget', 'vehicle'].includes(step.id) },
        el('summary', { style: { cursor: 'pointer', fontWeight: '700', padding: '8px 0' },
          text: `${step.emoji || ''} ${L(step.title)}` }),
        grid));
    }
  };
  const rebuildSoon = debounce(rebuild, 100);
  rebuild();

  modal({
    title: en ? 'Edit answers' : 'Editar respuestas',
    size: 'lg',
    body,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'), variant: 'primary',
        onClick: async () => {
          rec.data = draft;
          rec.meta = { ...(rec.meta || {}), editedByAdvisor: true, editedAt: new Date().toISOString() };
          rec.__needsUpload = true;
          rec.__envelope = S.publicJwk
            ? await seal({ id: rec.id, schemaVersion: SCHEMA_VERSION, createdAt: rec.createdAt, data: rec.data, meta: rec.meta }, S.publicJwk)
            : null;
          markDirty(rec);
          await persist(rec);
          renderBody();
          toast(en ? 'Saved.' : 'Guardado.', 'ok');
        },
      },
    ],
  });
}

/* =========================================================== calculator == */
function viewCalculator() {
  const en = I18n.lang === 'en';
  const wrap = el('section');
  wrap.append(el('div.page-head',
    el('div',
      el('h1', { text: en ? 'All-in cost calculator' : 'Calculadora de costo total' }),
      el('p', {
        text: en
          ? 'Hammer price in, real out-the-door number out — and the reverse.'
          : 'Metes el precio de martillo y sale el número real puesto en tu mano, y al revés.',
      }))));
  wrap.append(calculatorPanel({ budget: 10000 }, { fees: S.fees }));
  return wrap;
}

/* ============================================================= settings == */
function viewSettings() {
  const en = I18n.lang === 'en';
  const wrap = el('section');
  wrap.append(el('div.page-head', el('div',
    el('h1', { text: en ? 'Settings' : 'Ajustes' }),
    el('p', { text: en ? 'Repository, keys, fees and data.' : 'Repositorio, claves, tarifas y datos.' }))));

  /* ---- repo ---- */
  const f = (key, label, opts = {}) => {
    const input = el('input.input', {
      type: opts.password ? 'password' : 'text', value: S.settings[key] || '',
      placeholder: opts.placeholder || '', autocomplete: 'off',
      oninput: (e) => { S.settings[key] = e.target.value.trim(); },
    });
    return el('div.field', el('label.label', { text: label }),
      input, opts.help ? el('p.help', { text: opts.help }) : null);
  };

  const status = el('div.text-sm.text-muted');

  wrap.append(card(en ? 'Repository' : 'Repositorio', el('div.stack.gap-4',
    el('div.field-row', f('owner', 'Owner'), f('repo', 'Repo'), f('branch', 'Branch')),
    f('token', en ? 'GitHub token (fine-grained, Contents: read & write)' : 'Token de GitHub (fine-grained, Contents: lectura y escritura)', {
      password: true, placeholder: 'github_pat_…',
      help: en
        ? 'Stored only in this browser. Never committed, never put in a URL. Create it at github.com/settings/personal-access-tokens with access limited to this repository.'
        : 'Se guarda solo en este navegador. Nunca se sube ni se pone en una URL. Créalo en github.com/settings/personal-access-tokens limitado a este repositorio.',
    }),
    f('relayUrl', en ? 'Relay endpoint (optional)' : 'Endpoint de relay (opcional)', {
      placeholder: 'https://tu-app.vercel.app/api/submit',
      help: en ? 'When set, the intake form posts submissions straight into the repo in real time.'
               : 'Si lo defines, el formulario envía las solicitudes directo al repo en tiempo real.',
    }),
    el('label.switch',
      el('input', { type: 'checkbox', checked: S.settings.autoSync, onchange: (e) => { S.settings.autoSync = e.target.checked; saveSettings(); } }),
      el('span.track', el('span.thumb')),
      el('span', { text: en ? 'Sync automatically after every change' : 'Sincronizar automáticamente tras cada cambio' })),
    el('div.row.gap-2.wrap',
      el('button.btn.btn-primary.btn-sm', {
        type: 'button',
        onclick: async () => {
          saveSettings();
          status.textContent = t('common.loading');
          try {
            const v = await S.repo.verify();
            status.textContent = `✅ ${v.repo} · ${v.canPush ? (en ? 'write access' : 'con permiso de escritura') : (en ? 'read only' : 'solo lectura')}`;
            toast(t('common.save'), 'ok');
          } catch (e) { status.textContent = `❌ ${e.message}`; }
        },
      }, icon('check'), el('span', { text: en ? 'Save and test' : 'Guardar y probar' })),
      el('button.btn.btn-sm', { type: 'button', onclick: () => syncNow() },
        icon('refresh'), el('span', { text: en ? 'Sync now' : 'Sincronizar ahora' }))),
    status)));

  /* ---- keys ---- */
  wrap.append(card(en ? 'Encryption keys' : 'Claves de cifrado', el('div.stack.gap-4',
    el('p.text-sm.text-muted', {
      text: en
        ? 'Clients seal their answers with your public key. Only this browser (with your passphrase) can open them.'
        : 'Los clientes sellan sus respuestas con tu clave pública. Solo este navegador (con tu contraseña) puede abrirlas.',
    }),
    S.publicJwk ? el('div.row.gap-2.wrap',
      el('span.badge.badge-ok', { text: `kid ${S.publicJwk.kid || '—'}` }),
      el('button.btn.btn-sm', { type: 'button', onclick: showPublishKeyDialog },
        icon('cloud'), el('span', { text: en ? 'Publish public key' : 'Publicar clave pública' })),
      el('button.btn.btn-sm', {
        type: 'button',
        onclick: () => downloadBlob(`lsc-backup-${S.publicJwk.kid || 'key'}.json`,
          JSON.stringify({ kind: 'lsc-key-backup', createdAt: new Date().toISOString(), vault: store.get('vault'), publicKey: S.publicJwk }, null, 2),
          'application/json'),
      }, icon('download'), el('span', { text: en ? 'Download backup' : 'Descargar respaldo' })),
    ) : el('p.text-sm.text-muted', { text: en ? 'No public key stored.' : 'No hay clave pública guardada.' }))));

  /* ---- fees ---- */
  const feesArea = el('textarea.textarea', {
    rows: 12, spellcheck: 'false',
    style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' },
  });
  feesArea.value = JSON.stringify(S.fees, null, 2);
  wrap.append(card(en ? 'Fee tables' : 'Tablas de tarifas', el('div.stack.gap-3',
    el('p.text-sm.text-muted', {
      text: en
        ? 'Auction houses change their schedules. Edit these numbers whenever the official tables change — the calculator picks them up immediately.'
        : 'Las subastas cambian sus tarifarios. Edita estos números cuando cambien las tablas oficiales: la calculadora los toma al instante.',
    }),
    feesArea,
    el('div.row.gap-2.wrap',
      el('button.btn.btn-primary.btn-sm', {
        type: 'button',
        onclick: () => {
          try {
            S.fees = JSON.parse(feesArea.value);
            store.set('fees', S.fees);
            toast(t('common.save'), 'ok');
          } catch (e) { toast(`JSON: ${e.message}`, 'danger', 5000); }
        },
      }, icon('save'), el('span', { text: t('common.save') })),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        onclick: () => { S.fees = clone(DEFAULT_FEES); store.remove('fees'); renderBody(); },
      }, icon('refresh'), el('span', { text: en ? 'Restore defaults' : 'Restaurar valores' }))))));

  /* ---- data ---- */
  wrap.append(card(en ? 'Data' : 'Datos', el('div.stack.gap-3',
    el('div.row.gap-2.wrap',
      el('button.btn.btn-sm', { type: 'button', onclick: () => exportMenu([...S.records.values()]) },
        icon('download'), el('span', { text: en ? 'Export everything' : 'Exportar todo' })),
      el('button.btn.btn-sm', { type: 'button', onclick: openImportDialog },
        icon('upload'), el('span', { text: t('common.import') }))),
    el('div.divider'),
    el('button.btn.btn-danger.btn-sm', {
      type: 'button',
      onclick: async () => {
        const ok = await confirmDialog({
          title: en ? 'Wipe local data?' : '¿Borrar los datos locales?',
          message: en
            ? 'Removes every decrypted record from this device. Records in the repository are untouched and come back on the next sync.'
            : 'Elimina todos los registros descifrados de este dispositivo. Los del repositorio no se tocan y vuelven en la próxima sincronización.',
          danger: true,
        });
        if (!ok) return;
        await db.clear('records');
        S.records.clear();
        renderBody();
        toast(en ? 'Local data cleared.' : 'Datos locales borrados.', 'ok');
      },
    }, icon('trash'), el('span', { text: en ? 'Wipe local data' : 'Borrar datos locales' })))));

  return wrap;
}

/* ============================================================== dialogs == */
function shareLinkDialog() {
  const en = I18n.lang === 'en';
  const base = location.href.replace(/console\.html.*$/, '');
  const links = [
    [en ? 'Full form (Spanish)' : 'Formulario completo (español)', `${base}?lang=es`],
    [en ? 'Full form (English)' : 'Formulario completo (inglés)', `${base}?lang=en`],
    [en ? 'Express form' : 'Formulario exprés', `${base}?mode=express&lang=es`],
    [en ? 'Advisor mode (you fill it in)' : 'Modo asesor (lo rellenas tú)', `${base}?advisor=1&lang=es`],
  ];
  modal({
    title: en ? 'Share the intake form' : 'Compartir el formulario',
    size: 'lg',
    body: el('div.stack.gap-4',
      el('p.text-sm.text-muted', {
        text: en
          ? 'Send a link by WhatsApp, or open it yourself during a screen-shared call.'
          : 'Envía un enlace por WhatsApp, o ábrelo tú durante una videollamada con pantalla compartida.',
      }),
      ...links.map(([label, url]) => el('div.field',
        el('label.label', { text: label }),
        el('div.row.gap-2',
          el('input.input.grow.mono-sm', { value: url, readonly: true, onclick: (e) => e.target.select() }),
          el('button.btn.btn-sm', {
            type: 'button', 'aria-label': t('common.copy'),
            onclick: async () => { await copyText(url); toast(t('common.copied'), 'ok'); },
          }, icon('copy')),
          el('a.btn.btn-sm', {
            href: `https://wa.me/?text=${encodeURIComponent(url)}`, target: '_blank', rel: 'noopener',
            'aria-label': 'WhatsApp',
          }, icon('whatsapp')))))),
    actions: [{ label: t('common.close'), variant: 'ghost' }],
  });
}

function openImportDialog() {
  const en = I18n.lang === 'en';
  const zone = el('div.drop-zone',
    el('p', { text: en ? 'Drop .json files here, or click to choose' : 'Suelta archivos .json aquí, o haz clic para elegir' }));
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', multiple: true, class: 'hidden' });
  const pasteArea = el('textarea.textarea', {
    rows: 4, placeholder: en ? '…or paste a share link / JSON here' : '…o pega aquí un enlace compartido / JSON',
  });
  const log = el('div.stack.gap-2');

  const handleFiles = async (files) => {
    let ok = 0, bad = 0;
    for (const file of files) {
      try { await ingest(JSON.parse(await file.text()), { upload: true }); ok++; }
      catch { bad++; }
    }
    log.append(el('div.text-sm', { text: `✅ ${ok} · ❌ ${bad}` }));
    paint();
  };

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('over');
    handleFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

  modal({
    title: t('common.import'),
    body: el('div.stack.gap-4', zone, fileInput, pasteArea, log),
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      {
        label: t('common.import'), variant: 'primary', closeAfter: false,
        onClick: async () => {
          const raw = pasteArea.value.trim();
          if (!raw) return false;
          try {
            let payload;
            const m = /#import=([^\s&]+)/.exec(raw);
            if (m) payload = await unpackPayload(m[1]);
            else payload = JSON.parse(raw);
            await ingest(payload, { upload: true });
            toast(en ? 'Imported.' : 'Importado.', 'ok');
            pasteArea.value = '';
            paint();
          } catch (e) {
            toast(en ? `Could not read that: ${e.message}` : `No se pudo leer: ${e.message}`, 'danger', 5000);
          }
          return false;
        },
      },
    ],
  });
}

function exportMenu(records) {
  const en = I18n.lang === 'en';
  if (!records.length) { toast(en ? 'Nothing to export.' : 'Nada que exportar.', 'warn'); return; }
  const lang = I18n.lang;
  const n = records.length;
  const single = n === 1 ? records[0] : null;

  const options = [
    ['CSV (Excel)', 'csv', () => downloadBlob(exportFilename('clientes', 'csv', n), toCsv(records, lang), 'text/csv')],
    [en ? 'CSV — one row per answer' : 'CSV — una fila por respuesta', 'list', () => downloadBlob(exportFilename('respuestas', 'csv', n), toLongCsv(records, lang), 'text/csv')],
    ['JSON', 'file', () => downloadBlob(exportFilename('backup', 'json', n), toJson(records), 'application/json')],
    ['Markdown', 'file', () => downloadBlob(exportFilename('cartera', 'md', n), toMarkdownAll(records, lang), 'text/markdown')],
    [en ? 'Contacts (vCard)' : 'Contactos (vCard)', 'user', () => downloadBlob(exportFilename('contactos', 'vcf', n), toVCards(records, lang), 'text/vcard')],
  ];
  if (single) {
    options.push(
      [en ? 'Printable sheet / PDF' : 'Ficha imprimible / PDF', 'print', () => printRecord(single)],
      [en ? 'Copy WhatsApp brief' : 'Copiar resumen WhatsApp', 'whatsapp', async () => { await copyText(toWhatsApp(single, lang)); toast(t('common.copied'), 'ok'); }],
      [en ? 'Copy full text' : 'Copiar texto completo', 'copy', async () => { await copyText(toPlainText(single, lang)); toast(t('common.copied'), 'ok'); }],
      [en ? 'Copy Markdown' : 'Copiar Markdown', 'copy', async () => { await copyText(toMarkdown(single, lang)); toast(t('common.copied'), 'ok'); }],
    );
  }
  const sessions = records.flatMap((r) => (r.crm?.notes || [])
    .filter((x) => x.kind === 'meeting')
    .map((x) => ({ id: x.id, start: x.at, title: `${deepGet(r.data, 'contact.fullName') || r.id}`, description: x.text })));
  if (sessions.length) {
    options.push([en ? 'Sessions (iCal)' : 'Sesiones (iCal)', 'clock',
      () => downloadBlob(exportFilename('sesiones', 'ics', sessions.length), toICal(sessions, lang), 'text/calendar')]);
  }

  const { close } = modal({
    title: `${t('common.export')} · ${n} ${n === 1 ? (en ? 'record' : 'registro') : (en ? 'records' : 'registros')}`,
    body: el('div.stack.gap-2', ...options.map(([label, ico, run]) =>
      el('button.btn.btn-block', {
        type: 'button', style: { justifyContent: 'flex-start' },
        onclick: async () => { await run(); close(); },
      }, icon(ico), el('span', { text: label })))),
    actions: [{ label: t('common.close'), variant: 'ghost' }],
  });
}

function printRecord(record) {
  const html = toPrintableHtml(record, I18n.lang);
  const w = window.open('', '_blank');
  if (!w) { downloadBlob(`${record.id}.html`, html, 'text/html'); return; }
  w.document.write(html);
  w.document.close();
  w.addEventListener('load', () => setTimeout(() => w.print(), 220));
}

/* Exposed for tests. */
export const _internals = { S, ingest, filteredRecords, matchesQuery };
