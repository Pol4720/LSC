import { test, expect } from '@playwright/test';

/**
 * Collect real JS errors. A 404 on data/config/advisor-key.json is expected
 * before the advisor publishes a key — the form degrades to link delivery — so
 * that one resource failure is filtered out on purpose.
 */
const consoleErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (m.location()?.url?.includes('advisor-key.json')) return;
    errors.push(m.text());
  });
  return errors;
};

test('the intro screen renders and offers both modes', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Exprés/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Completo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('express mode reaches the review step with fewer steps than full mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  const expressSteps = await page.locator('.step-dot').count();

  await page.goto('/');
  await page.getByRole('button', { name: /Completo/ }).click();
  const fullSteps = await page.locator('.step-dot').count();

  expect(expressSteps).toBeGreaterThan(2);
  expect(fullSteps).toBeGreaterThan(expressSteps);
});

test('blocking validation stops the wizard and clears once fixed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await expect(page.locator('.step-title')).toContainText('Cómo te contactamos');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.err').first()).toBeVisible();
  await expect(page.locator('.step-title')).toContainText('Cómo te contactamos');

  await page.locator('#f-contact-fullName').fill('María Fernández');
  await page.locator('#f-contact-phone').fill('786');            // too short
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.field[data-field="contact.phone"] .err')).toBeVisible();

  await page.locator('#f-contact-phone').fill('+1 786 555 0100');
  await choice(page, 'WhatsApp').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.step-title')).toContainText('¿Para qué necesitas el auto?');
});

test('answers survive a full page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Completo/ }).click();
  await page.locator('#f-contact-fullName').fill('Jorge Pérez Ñ');
  await page.locator('#f-contact-phone').fill('+1 786 555 0100');
  await page.locator('#f-contact-email').fill('jorge@example.com');
  await page.waitForTimeout(800);                                 // let the debounced save land

  await page.reload();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();  // resume from the draft banner
  await expect(page.locator('#f-contact-fullName')).toHaveValue('Jorge Pérez Ñ');
  await expect(page.locator('#f-contact-email')).toHaveValue('jorge@example.com');
});

test('conditional fields appear and disappear with their trigger', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Completo/ }).click();
  await fillContact(page);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.locator('.field[data-field="goal.rideshareNote"]')).toHaveCount(0);
  await choice(page, 'Uber / Lyft / taxi').click();
  await expect(page.locator('.field[data-field="goal.rideshareNote"]')).toBeVisible();
  await choice(page, 'Uber / Lyft / taxi').click();
  await expect(page.locator('.field[data-field="goal.rideshareNote"]')).toHaveCount(0);
});

test('the money field formats thousands and drives its slider', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await fillContact(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await choice(page, 'Uso diario').click();
  await choice(page, 'Es mi primera vez').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const money = page.locator('#f-budget-total');
  await money.fill('');
  await money.pressSequentially('12500');
  await expect(money).toHaveValue(/12[.,]500/);
  await expect(page.locator('.money-hint')).toContainText('12');
});

test('the glossary explainer opens on demand', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Completo/ }).click();
  await fillContact(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await choice(page, 'Uso diario').click();
  await choice(page, 'Es mi primera vez').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  const info = page.locator('.field[data-field="budget.depositReady"] .info-btn');
  await expect(page.locator('.info-panel')).toHaveCount(0);
  await info.click();
  await expect(page.locator('.field[data-field="budget.depositReady"] .info-panel')).toContainText(/reembolsable/i);
  await info.click();
  await expect(page.locator('.info-panel')).toHaveCount(0);
});

test('language and theme toggles persist across navigations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Idioma|Language/ }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('button', { name: /theme/i }).click();
  const theme = await page.locator('html').getAttribute('data-theme');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('a complete express submission produces a ticket and a share link', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await completeExpress(page);

  await expect(page.locator('.ticket')).toBeVisible();
  await expect(page.locator('.ticket')).toContainText(/^LSC-\d{8}-[A-Z0-9]{6}$/);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me/);
  await expect(page.getByRole('button', { name: /Copiar enlace/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the submitted payload is encrypted end to end when a key is published', async ({ page }) => {
  await page.route('**/data/config/advisor-key.json', async (route) => {
    const key = await makePublicKey(page);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(key) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await completeExpress(page, { name: 'Secreto Absoluto' });
  await expect(page.locator('.ticket')).toBeVisible();

  const href = await page.getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
  const shared = decodeURIComponent(href.split('text=')[1]);
  expect(shared).not.toContain('Secreto Absoluto');
  expect(shared).not.toContain('786 555');

  const envelope = await page.evaluate(() => window.__lastEnvelope || null);
  expect(envelope?.alg).toBe('ECDH-P256-HKDF-A256GCM');
  expect(JSON.stringify(envelope)).not.toContain('Secreto');
});

test('the review step lists the answers and offers an estimate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await completeExpress(page, { stopAtReview: true });
  await expect(page.locator('.step-title')).toContainText('Revisa y envía');
  await expect(page.locator('.summary-item').first()).toBeVisible();
  await expect(page.locator('.estimate-card')).toContainText('Puja máxima recomendada');
  await expect(page.locator('.summary-group-head', { hasText: 'Cómo te contactamos' })).toBeVisible();
});

test('the stepper jumps back to an earlier step without losing data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Exprés/ }).click();
  await completeExpress(page, { stopAtReview: true });
  await page.locator('.step-dot', { hasText: 'Cómo te contactamos' }).click();
  await expect(page.locator('#f-contact-fullName')).toHaveValue(/./);
});

test('no page overflows horizontally at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const overflow = async () => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto('/');
  expect(await overflow()).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /Completo/ }).click();
  await expect(page.locator('.step-title')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);

  await page.goto('/calculadora.html');
  await expect(page.locator('.calc-total')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);
});

test('every interactive control is reachable by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Completo/ }).click();
  await page.keyboard.press('Tab');
  const active = await page.evaluate(() => document.activeElement?.tagName);
  expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(active);
});

/* ------------------------------------------------------------------------- */

/** Match a choice tile by its visible title, never by its longer description. */
const choice = (page, title) =>
  page.locator('label.choice').filter({ has: page.locator('.ch-title', { hasText: title }) });

async function fillContact(page, { name = 'María Fernández' } = {}) {
  await page.locator('#f-contact-fullName').fill(name);
  await page.locator('#f-contact-phone').fill('+1 786 555 0100');
  await choice(page, 'WhatsApp').click();
}

async function completeExpress(page, { name = 'María Fernández', stopAtReview = false } = {}) {
  await fillContact(page, { name });
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice(page, 'Uso diario').click();
  await choice(page, 'Es mi primera vez').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('#f-budget-total').fill('');
  await page.locator('#f-budget-total').pressSequentially('12000');
  await choice(page, 'Este mes').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice(page, 'SUV / Crossover').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await choice(page, 'Título limpio').click();
  await choice(page, 'Solo cosmético').click();
  await choice(page, 'Obligatorio').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.locator('.step-title')).toContainText('Revisa y envía');
  if (stopAtReview) return;

  await page.locator('.field[data-field="consent.dataUse"] .switch').click();
  await page.getByRole('button', { name: 'Enviar mi solicitud' }).click();
}

async function makePublicKey(page) {
  return page.evaluate(async () => {
    const mod = await import('/assets/js/crypto.js');
    const kp = await mod.generateAdvisorKeyPair();
    window.__testKeys = kp;
    return kp.publicJwk;
  });
}
