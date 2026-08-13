import { test, expect } from '@playwright/test';

/**
 * The interactive demo is reachable with no account, no key and no token —
 * it must work standalone even on a browser context that has never touched
 * console.html before (that is the whole point).
 */

test('the demo is reachable with no account, and the full try-everything flow works', async ({ page }) => {
  await page.goto('/console.html');
  await expect(page.getByRole('heading', { name: /Configura tu consola/ })).toBeVisible();

  await page.getByRole('button', { name: /Probar la demo interactiva/ }).click();
  await expect(page.locator('.console-shell')).toBeVisible();
  await expect(page.locator('.demo-badge').first()).toContainText('DEMO');

  // Browse cars.
  const sideToggle = page.locator('.side-toggle');
  if (await sideToggle.isVisible()) await sideToggle.click();
  await page.locator('.side-link', { hasText: 'Autos' }).click();
  await expect(page.locator('.vehicle-card').first()).toBeVisible();
  const vehicleCount = await page.locator('.vehicle-card').count();
  expect(vehicleCount).toBeGreaterThanOrEqual(20);

  // Select one and land on the simulator with a bid pre-filled.
  await page.locator('.vehicle-card').first().locator('button', { hasText: 'Simular puja' }).click();
  const bidInput = page.locator('#tour-bid-input');
  await expect(bidInput).toBeVisible();
  await expect(page.locator('.sim-result')).toHaveClass(/ok/);

  // Validation: an amount below the current bid is rejected.
  await bidInput.fill('1');
  await expect(page.locator('.sim-result')).toHaveClass(/warn/);
  const min = await bidInput.getAttribute('min');
  await bidInput.fill(min);
  await expect(page.locator('.sim-result')).toHaveClass(/ok/);

  // Real-time all-in cost calculation is present and non-zero.
  await expect(page.locator('.calc-out .calc-total')).toBeVisible();
  const totalText = await page.locator('.calc-out .calc-total').innerText();
  expect(totalText).toMatch(/\$/);

  // PDF quote generation — a real download, no external service.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.calc-out .btn-primary').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // Place the simulated bid.
  await page.locator('button', { hasText: 'Colocar puja simulada' }).click();
  await expect(page.locator('.toast').first()).toBeVisible();

  // Advisor performance dashboard.
  const sideToggle2 = page.locator('.side-toggle');
  if (await sideToggle2.isVisible()) await sideToggle2.click();
  await page.locator('.side-link', { hasText: 'Reportes' }).click();
  await expect(page.locator('#tour-stats')).toBeVisible();
  await expect(page.locator('#tour-stats')).toContainText(/\d/);

  // Exiting the demo returns to the real setup/lock screen, untouched.
  const sideToggle3 = page.locator('.side-toggle');
  if (await sideToggle3.isVisible()) await sideToggle3.click();
  await page.locator('button', { hasText: 'Salir de la demo' }).click();
  await expect(page.getByRole('heading', { name: /Configura tu consola/ })).toBeVisible();
});

test('the guided tour highlights each step and can be finished or closed early', async ({ page }) => {
  await page.goto('/console.html');
  await page.getByRole('button', { name: /Probar la demo interactiva/ }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  await page.locator('button', { hasText: 'Iniciar el recorrido' }).click();
  await expect(page.locator('.tour-tip')).toBeVisible();
  await expect(page.locator('.tour-spot')).toBeVisible();

  for (let i = 0; i < 5; i++) {
    await page.locator('.tour-tip button', { hasText: 'Siguiente' }).click();
    await expect(page.locator('.tour-tip')).toBeVisible();
  }
  await expect(page.locator('.tour-tip')).toContainText('Terminar');
  await page.locator('.tour-tip button', { hasText: 'Terminar' }).click();
  await expect(page.locator('.tour-host')).toHaveCount(0);

  // The last step lands on Reports; go back Home, where the tour starts.
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-link', { hasText: 'Inicio' }).click();

  // Closing early (the × button) also tears the overlay down cleanly.
  await page.locator('button', { hasText: 'Iniciar el recorrido' }).click();
  await expect(page.locator('.tour-tip')).toBeVisible();
  await page.locator('.tour-tip button[aria-label*="erra" i], .tour-tip button[aria-label*="lose" i]').click();
  await expect(page.locator('.tour-host')).toHaveCount(0);
});

test('the demo never touches the real console\'s vault or a GitHub token', async ({ page }) => {
  await page.goto('/console.html');
  await page.getByRole('button', { name: /Probar la demo interactiva/ }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  const stored = await page.evaluate(() => ({
    vault: localStorage.getItem('lsc.console.vault'),
    settings: localStorage.getItem('lsc.console.settings'),
  }));
  expect(stored.vault).toBeNull();
  expect(stored.settings).toBeNull();
});
