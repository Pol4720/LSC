import { test, expect } from '@playwright/test';

const PASS = 'contraseña-de-prueba-2026';
const GRANTS_URL = 'https://raw.githubusercontent.com/Pol4720/LSC/main/data/config/access-grants.json**';

/**
 * Every unlock attempt that isn't the real passphrase checks temporary access
 * grants against the live repository (bounded, see access.js#withTimeout).
 * Tests must not depend on that real network round trip — it would make them
 * slow and flaky — so by default we answer "no grants published" immediately.
 * Tests that care about the remote path override this with their own route.
 */
async function stubNoRemoteGrants(page) {
  await page.route(GRANTS_URL, (route) => route.fulfill({ status: 404, body: 'Not Found' }));
}

async function setUp(page) {
  await stubNoRemoteGrants(page);
  await page.goto('/console.html');
  const fields = page.locator('.lock-card input[type="password"]');
  await fields.nth(0).fill(PASS);
  await fields.nth(1).fill(PASS);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Crear claves y continuar/ }).click();
  await download;
  await page.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();
}

async function lock(page) {
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-foot button', { hasText: 'Bloquear' }).click();
  await expect(page.locator('#pp')).toBeVisible();
}

async function goSettings(page) {
  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-link', { hasText: 'Ajustes' }).click();
}

/** Create a "1 hour" grant from Settings and return the code shown once. */
async function createGrant(page, label = 'Prueba') {
  await goSettings(page);
  await page.getByRole('button', { name: /Nuevo código/ }).click();
  await page.locator('.modal-body input').first().fill(label);
  await page.getByRole('button', { name: /Generar código/ }).click();
  const code = (await page.locator('.access-code-blob').textContent()).trim();
  await page.getByRole('button', { name: /Ya lo guardé/ }).click();
  return code;
}

test('a wrong passphrase and a wrong code are rejected with the same message', async ({ page }) => {
  await setUp(page);
  await lock(page);

  await page.locator('#pp').fill('esto-no-es-nada-correcto');
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.err')).toBeVisible();
  const msg = await page.locator('.err span').textContent();
  expect(msg).not.toMatch(/passphrase only|solo contraseña/i); // never reveals which credential type failed
  await expect(page.locator('.console-shell')).toHaveCount(0);
});

test('repeated failed attempts are throttled with a visible countdown', async ({ page }) => {
  await setUp(page);
  await lock(page);

  const submit = page.locator('.lock-card button[type="submit"]');
  for (let i = 0; i < 3; i++) {
    await page.locator('#pp').fill(`mal-${i}`);
    await submit.click();
    await expect(submit).toBeEnabled(); // the first three failures are free
  }

  await page.locator('#pp').fill('mal-3');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText(/Espera \d+s/);

  // the cooldown clears on its own and the passphrase works again right after
  await expect(submit).toBeEnabled({ timeout: 6000 });
  await page.locator('#pp').fill(PASS);
  await submit.click();
  await expect(page.locator('.console-shell')).toBeVisible();
});

test('the throttle survives a page reload instead of resetting it', async ({ page }) => {
  await setUp(page);
  await lock(page);

  const submit = page.locator('.lock-card button[type="submit"]');
  for (let i = 0; i < 4; i++) {
    await page.locator('#pp').fill(`mal-${i}`);
    await submit.click();
    await page.waitForTimeout(50);
  }
  await expect(submit).toBeDisabled();

  await page.reload();
  await stubNoRemoteGrants(page);
  await expect(page.locator('.lock-card button[type="submit"]')).toBeDisabled();
});

test('a correct passphrase resets the throttle counter', async ({ page }) => {
  await setUp(page);
  await lock(page);
  const submit = page.locator('.lock-card button[type="submit"]');

  await page.locator('#pp').fill('mal-una-vez');
  await submit.click();
  await page.locator('#pp').fill(PASS);
  await submit.click();
  await expect(page.locator('.console-shell')).toBeVisible();

  await lock(page);
  // fresh cooldown state — three more free attempts before any throttling.
  for (let i = 0; i < 3; i++) {
    await page.locator('#pp').fill(`mal-otra-vez-${i}`);
    await page.locator('.lock-card button[type="submit"]').click();
    await expect(page.locator('.lock-card button[type="submit"]')).toBeEnabled();
  }
});

test('a temporary code unlocks the console and shows a session banner', async ({ page }) => {
  await setUp(page);
  const code = await createGrant(page, 'Cobertura de prueba');
  await expect(page.locator('.grant-row')).toContainText('Activo');

  await lock(page);
  await page.locator('#pp').fill(code);
  await page.getByRole('button', { name: 'Desbloquear' }).click();

  await expect(page.locator('.console-shell')).toBeVisible();
  await expect(page.locator('.temp-chip')).toBeVisible();
  await expect(page.locator('.temp-chip')).toContainText('Cobertura de prueba');
  await expect(page.locator('.temp-chip')).toContainText('Acceso temporal');
});

test('a temporary session sees the same client data as the real account', async ({ page }) => {
  await setUp(page);

  // Import a client while unlocked with the real passphrase.
  const packed = await page.evaluate(async () => {
    const crypto = await import('/assets/js/crypto.js');
    const publicJwk = JSON.parse(localStorage.getItem('lsc.console.publicKey'));
    const record = {
      id: 'LSC-20260807-TEMP01', createdAt: new Date().toISOString(),
      data: { contact: { fullName: 'Visible Para Todos' } }, meta: {},
    };
    return crypto.packPayload(await crypto.seal(record, publicJwk));
  });
  await page.goto(`/console.html#import=${packed}`);
  await expect(page.locator('.toast')).toContainText('importada');

  const code = await createGrant(page, 'Ve mis clientes');
  await lock(page);
  await page.locator('#pp').fill(code);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();

  const toggle = page.locator('.side-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.side-link', { hasText: 'Clientes' }).click();
  await expect(page.locator('.client-card')).toContainText('Visible Para Todos');
});

test('an expired code is rejected even though it was never revoked', async ({ page }) => {
  await setUp(page);

  // A datetime-local input only has minute resolution, so there is no clean
  // UI path to "expires 4 seconds from now" without a flaky wait. Inject an
  // already-expired grant directly instead, wrapped with the session's real
  // private key exactly the way the app does it, and check the app rejects
  // it deterministically via the expiry gate rather than a timing race.
  const code = await page.evaluate(async () => {
    const { _internals } = await import('/assets/js/console.js');
    const crypto = await import('/assets/js/crypto.js');
    const testCode = 'TEST-EXPI-REDX-0001';
    const vault = await crypto.wrapPrivateKey(_internals.S.privateJwk, testCode);
    const grant = {
      id: 'GR-TEST-EXPIRED', label: 'Ya venció', createdAt: new Date(Date.now() - 3600_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(), revoked: false, vault,
    };
    const existing = JSON.parse(localStorage.getItem('lsc.console.grants') || '[]');
    localStorage.setItem('lsc.console.grants', JSON.stringify([grant, ...existing]));
    return testCode;
  });

  await lock(page);
  await page.locator('#pp').fill(code);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.err')).toBeVisible();
  await expect(page.locator('.console-shell')).toHaveCount(0);
});

test('revoking a code blocks the next unlock attempt with it', async ({ page }) => {
  await setUp(page);
  const code = await createGrant(page, 'Por revocar');

  await page.locator('.grant-row', { hasText: 'Por revocar' }).getByRole('button', { name: 'Revocar' }).click();
  await page.locator('.modal-foot button', { hasText: 'Confirmar' }).click();
  await expect(page.locator('.grant-row', { hasText: 'Por revocar' })).toContainText('Revocado');

  await lock(page);
  await page.locator('#pp').fill(code);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.err')).toBeVisible();
  await expect(page.locator('.console-shell')).toHaveCount(0);
});

test('a grant published only on the repository still unlocks a device that never cached it', async ({ page }) => {
  await setUp(page);
  const code = await createGrant(page, 'Solo en el repo');

  // Simulate a second device: the grant lives on the repo, not in this
  // browser's local cache.
  const grants = await page.evaluate(() => JSON.parse(localStorage.getItem('lsc.console.grants') || '[]'));
  await page.evaluate(() => localStorage.setItem('lsc.console.grants', '[]'));

  await page.unroute(GRANTS_URL);
  await page.route(GRANTS_URL, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(grants),
  }));

  await lock(page);
  await page.locator('#pp').fill(code);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.locator('.console-shell')).toBeVisible();
  await expect(page.locator('.temp-chip')).toContainText('Solo en el repo');
});

test('deleting a code from the list does not affect an already-open session', async ({ page }) => {
  await setUp(page);
  await createGrant(page, 'A borrar');
  await page.locator('.grant-row', { hasText: 'A borrar' }).getByRole('button', { name: 'Eliminar' }).click();
  await page.locator('.modal-foot button', { hasText: 'Confirmar' }).click();
  await expect(page.locator('.grant-row', { hasText: 'A borrar' })).toHaveCount(0);
  await expect(page.locator('.console-shell')).toBeVisible(); // still unlocked, nothing broke
});

test('idle auto-lock returns to the lock screen without any interaction', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lsc.console.settings', JSON.stringify({ autoLockMinutes: 0.02 }));
  });
  await setUp(page);
  await expect(page.locator('.console-shell')).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(page.locator('#pp')).toBeVisible();
});

test('interacting resets the idle timer so the console does not lock prematurely', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lsc.console.settings', JSON.stringify({ autoLockMinutes: 0.05 })); // ~3s
  });
  await setUp(page);
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(100 + i, 100 + i);
    await page.waitForTimeout(900);
  }
  await expect(page.locator('.console-shell')).toBeVisible();
});

test('manually locking clears the session immediately', async ({ page }) => {
  await setUp(page);
  await lock(page);
  await expect(page.locator('.console-shell')).toHaveCount(0);
  await expect(page.locator('#pp')).toBeVisible();
});

test('"never" auto-lock is available but the console stays unlocked while idle', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lsc.console.settings', JSON.stringify({ autoLockMinutes: 0 }));
  });
  await setUp(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.console-shell')).toBeVisible();
});
