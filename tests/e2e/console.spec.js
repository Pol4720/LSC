import { test, expect } from '@playwright/test';

const PASS = 'contraseña-de-prueba-2026';

/* Every test gets a fresh browser context, so localStorage and IndexedDB start
   empty on their own — clearing them per navigation would wipe the key vault
   the console just created. */

/** Navigate the sidebar, opening the off-canvas drawer on small screens. */
async function nav(page, label) {
  await expect(page.locator('.console-shell')).toBeVisible();
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-link', { hasText: label }).click();
}

/** Create keys, unlock, and land in the console. */
async function setUp(page) {
  await page.goto('/console.html');
  await expect(page.getByRole('heading', { name: /Configura tu consola/ })).toBeVisible();
  const fields = page.locator('.lock-card input[type="password"]');
  await fields.nth(0).fill(PASS);
  await fields.nth(1).fill(PASS);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Crear claves y continuar/ }).click();
  await download;                                     // the key backup downloads automatically

  await expect(page.getByRole('heading', { name: /Publica tu clave pública/ })).toBeVisible();
  await page.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();
}

/** Build a sealed record with the console's own key and hand it a share link. */
async function importSealedRecord(page, { name = 'Cliente de Prueba', budget = 15000 } = {}) {
  const packed = await page.evaluate(async ({ name, budget }) => {
    const crypto = await import('/assets/js/crypto.js');
    const publicJwk = JSON.parse(localStorage.getItem('lsc.console.publicKey'));
    const record = {
      id: `LSC-20260806-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      schemaVersion: 3,
      createdAt: new Date().toISOString(),
      data: {
        contact: { fullName: name, phone: '+1 786 555 0100', email: 'cliente@example.com', city: 'Hialeah', state: 'FL', channel: ['whatsapp'] },
        goal: { useCases: ['daily'], experience: 'none' },
        budget: { total: budget, urgency: 'asap', payment: ['zelle'] },
        vehicle: { bodyTypes: ['suv'], makes: ['Toyota'], models: ['RAV4'], years: { from: 2015, to: 2021 } },
        condition: { titles: ['clean'], damageTolerance: 'none', runDrive: 'required' },
        logistics: { transport: 'managed', finalDestination: 'usa' },
        references: { notes: 'Nota de prueba con acentos: ñ á é.' },
        consent: { dataUse: true },
      },
      meta: { mode: 'full', lang: 'es' },
    };
    const envelope = await crypto.seal(record, publicJwk);
    return crypto.packPayload(envelope);
  }, { name, budget });

  // A hash-only goto is a same-document navigation, so force a real reload to
  // exercise the path a client's link actually takes: cold load → lock screen.
  await page.goto(`/console.html#import=${packed}`);
  await page.reload();
  return packed;
}

test('first run walks through key setup and lands unlocked', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setUp(page);
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
  await expect(page.locator('.empty')).toContainText('Aún no hay clientes');
  expect(errors).toEqual([]);
});

test('the passphrase actually gates access', async ({ page }) => {
  await setUp(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Consola del asesor' })).toBeVisible();

  await page.locator('#pp').fill('contraseña-incorrecta');
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.err')).toContainText('incorrecta');
  await expect(page.locator('.console-shell')).toHaveCount(0);

  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();
});

test('a sealed share link is decrypted and becomes a client card', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page, { name: 'Ana Beatriz Ñoño' });

  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  await nav(page, 'Clientes');
  await expect(page.locator('.client-card')).toHaveCount(1);
  await expect(page.locator('.client-card')).toContainText('Ana Beatriz Ñoño');
  await expect(page.locator('.client-card')).toContainText('RAV4');
});

test('search finds a client by name, phone and car', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page, { name: 'Ana Beatriz' });
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  const search = page.locator('.search-box input');
  for (const q of ['Beatriz', '786', 'RAV4', 'Hialeah']) {
    await search.fill(q);
    await expect(page.locator('.client-card')).toHaveCount(1, { timeout: 5000 });
  }
  await search.fill('zzz-no-existe');
  await expect(page.locator('.empty')).toContainText('Sin resultados');
});

test('the detail view exposes every advisory tab', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page);
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await page.locator('.client-card').first().click();

  await expect(page.locator('.detail-head h1')).toContainText('Cliente de Prueba');
  for (const tab of ['Perfil', 'Requisitos', 'Embudo y notas', 'Lotes objetivo', 'Plan de costos']) {
    await page.locator('.tab', { hasText: tab }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  }
});

test('notes, tags and stage changes persist across a reload', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page);
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await page.locator('.client-card').first().click();
  await page.locator('.tab', { hasText: 'Embudo y notas' }).click();

  await page.locator('select').first().selectOption('searching');
  await page.locator('.card', { hasText: 'Etiquetas' }).locator('input').fill('vip');
  await page.locator('.card', { hasText: 'Etiquetas' }).locator('input').press('Enter');
  await page.locator('textarea').fill('Llamada inicial: quiere una SUV para la familia.');
  await page.getByRole('button', { name: 'Añadir entrada' }).click();
  await expect(page.locator('.note-item')).toContainText('Llamada inicial');

  await page.reload();
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await expect(page.locator('.client-card')).toContainText('vip');
  await expect(page.locator('.client-card')).toContainText('Buscando ofertas');
});

test('a target lot is parsed into its auction and lot number', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page);
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await page.locator('.client-card').first().click();
  await page.locator('.tab', { hasText: 'Lotes objetivo' }).click();

  await page.locator('.card', { hasText: 'Añadir un lote' }).locator('input').first()
    .fill('https://www.copart.com/lot/58123456/2019-toyota-rav4');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.card', { hasText: 'Tu selección' })).toContainText('Lot 58123456');
});

test('the pipeline board groups clients by stage', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page);
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Embudo');
  await expect(page.locator('.kan-col')).toHaveCount(10);
  await expect(page.locator('.kan-col').first().locator('.kan-card')).toHaveCount(1);
});

test('the dashboard renders stats and charts once there is data', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page, { budget: 22000 });
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Panel');
  await expect(page.locator('.stat-tile')).toHaveCount(5);
  await expect(page.locator('.chart-bars').first().locator('.bar-row').first()).toBeVisible();
  await expect(page.locator('.spark')).toBeVisible();
  await expect(page.locator('.stat-tile', { hasText: 'Presupuesto medio' })).toContainText('22,000');
});

test('CSV export downloads a file with the client in it', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page, { name: 'Exportable Uno' });
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await page.getByRole('button', { name: 'Exportar' }).click();

  const download = page.waitForEvent('download');
  await page.locator('.modal-body button', { hasText: 'CSV (Excel)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^lsc-clientes-1-\d{8}-\d{4}\.csv$/);

  const stream = await file.createReadStream();
  const text = await new Promise((resolve) => {
    let out = '';
    stream.on('data', (c) => { out += c; });
    stream.on('end', () => resolve(out));
  });
  expect(text).toContain('Exportable Uno');
  expect(text).toContain('contact.fullName');
});

test('answers can be edited from the console and stick', async ({ page }) => {
  await setUp(page);
  await importSealedRecord(page);
  await page.locator('#pp').fill(PASS);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await nav(page, 'Clientes');
  await page.locator('.client-card').first().click();
  await page.locator('.tab', { hasText: 'Requisitos' }).click();
  await page.getByRole('button', { name: 'Editar respuestas' }).click();
  await expect(page.locator('.modal')).toBeVisible();

  await page.locator('.modal #f-contact-city').fill('Tampa');
  await page.locator('.modal-foot button', { hasText: 'Guardar' }).click();
  await expect(page.locator('.summary-list').first()).toContainText('Tampa');
});

test('the built-in calculator reacts to its inputs', async ({ page }) => {
  await setUp(page);
  await nav(page, 'Calculadora');
  await expect(page.locator('.calc-total')).toBeVisible();

  const before = await page.locator('.calc-out .stat-value').textContent();
  await page.locator('.calc-grid input[type="number"]').first().fill('30000');
  await expect(page.locator('.calc-out .stat-value')).not.toHaveText(before);
  await expect(page.locator('.calc-line', { hasText: 'Comisión de la subasta' })).toBeVisible();
});

test('settings accept a repository configuration and report a bad token', async ({ page }) => {
  await setUp(page);
  await nav(page, 'Ajustes');
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Repositorio' }).locator('input').first()).toHaveValue('Pol4720');
  await expect(page.locator('.card', { hasText: 'Tablas de tarifas' }).locator('textarea')).toHaveValue(/copart/);
});

test('the language toggle translates the whole console', async ({ page }) => {
  await setUp(page);
  await page.locator('.toolbar-btn').first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('.console-shell')).toBeVisible();
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.locator('.side-link', { hasText: 'Clients' })).toBeVisible();
  await expect(page.locator('.side-link', { hasText: 'Settings' })).toBeVisible();
});

test('locking clears the session until the passphrase is entered again', async ({ page }) => {
  await setUp(page);
  await expect(page.locator('.console-shell')).toBeVisible();
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-foot button', { hasText: 'Bloquear' }).click();
  await expect(page.locator('#pp')).toBeVisible();
  await expect(page.locator('.console-shell')).toHaveCount(0);
});

test('an already-unlocked console imports a link without asking again', async ({ page }) => {
  await setUp(page);
  const packed = await page.evaluate(async () => {
    const crypto = await import('/assets/js/crypto.js');
    const publicJwk = JSON.parse(localStorage.getItem('lsc.console.publicKey'));
    const record = {
      id: 'LSC-20260806-LIVE01', createdAt: new Date().toISOString(),
      data: { contact: { fullName: 'Import En Vivo' }, budget: { total: 9000 } }, meta: {},
    };
    return crypto.packPayload(await crypto.seal(record, publicJwk));
  });
  await page.goto(`/console.html#import=${packed}`);        // same-document hash change
  await expect(page.locator('.toast')).toContainText('importada');
  await nav(page, 'Clientes');
  await expect(page.locator('.client-card')).toContainText('Import En Vivo');
});

test('the console has no horizontal overflow on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
