import { test, expect } from '@playwright/test';

/**
 * GitHub Pages serves a project site from https://<user>.github.io/<repo>/,
 * never from the domain root. Every asset path, every generated link and every
 * fetch must therefore be relative. This suite runs the whole app against a
 * server that mounts it under /LSC/ and fails if anything assumes the root.
 */
const BASE = 'http://127.0.0.1:4174/LSC/';

/** Collect anything that would show up as a broken page in production. */
function watch(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if ((m.location()?.url || '').includes('advisor-key.json')) return;  // expected 404
    problems.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('advisor-key.json')) return;
    problems.push(`request failed: ${r.url()}`);
  });
  return problems;
}

test('the form loads and runs from a subpath with no broken references', async ({ page }) => {
  const problems = watch(page);
  await page.goto(BASE);
  await expect(page.getByRole('button', { name: /Completo/ })).toBeVisible();
  await page.getByRole('button', { name: /Completo/ }).click();
  await expect(page.locator('.step-title')).toContainText('Cómo te contactamos');
  expect(problems).toEqual([]);
});

test('the share link the client sends keeps the subpath', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Exprés/ }).click();

  const choice = (title) =>
    page.locator('label.choice').filter({ has: page.locator('.ch-title', { hasText: title }) });

  await page.locator('#f-contact-fullName').fill('Prueba Subruta');
  await page.locator('#f-contact-phone').fill('+1 786 555 0100');
  await choice('WhatsApp').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice('Uso diario').click();
  await choice('Es mi primera vez').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('#f-budget-total').fill('');
  await page.locator('#f-budget-total').pressSequentially('9000');
  await choice('Este mes').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice('SUV / Crossover').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice('Título limpio').click();
  await choice('Solo cosmético').click();
  await choice('Obligatorio').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('.field[data-field="consent.dataUse"] .switch').click();
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click();
  await expect(page.locator('.ticket')).toBeVisible();

  const wa = await page.getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
  const shared = decodeURIComponent(wa.split('text=')[1]);
  expect(shared).toContain('/LSC/console.html#import=');
  expect(shared).not.toContain('//console.html');
});

test('the console and its launcher work from a subpath', async ({ page }) => {
  const problems = watch(page);
  await page.goto(`${BASE}console.html`);

  const fields = page.locator('.lock-card input[type="password"]');
  await fields.nth(0).fill('contraseña-de-prueba-2026');
  await fields.nth(1).fill('contraseña-de-prueba-2026');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Crear claves y continuar/ }).click();
  await download;
  await page.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  await page.locator('.launcher-fab').click();
  await expect(page.locator('.launcher-item').first()).toBeVisible();

  // The intake links the advisor shares must carry the subpath too.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Compartir enlace' }).click();
  await expect(page.locator('.modal-body input').first()).toHaveValue(/\/LSC\/\?lang=es$/);

  expect(problems).toEqual([]);
});

test('the calculator works from a subpath', async ({ page }) => {
  const problems = watch(page);
  await page.goto(`${BASE}calculadora.html`);
  await expect(page.locator('.calc-total')).toBeVisible();
  await expect(page.locator('.launcher-fab')).toBeVisible();
  expect(problems).toEqual([]);
});
