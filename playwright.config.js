import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Some sandboxes ship a pre-installed Chromium that does not match the
 * revision this Playwright version would download. Point at it when present
 * so `playwright install` is never needed.
 */
const PREINSTALLED = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const launchOptions = PREINSTALLED
  ? { executablePath: PREINSTALLED, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
  : {};
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The dev server is a single Node process; too many parallel pages starve
  // rAF and make Playwright's stability checks flap.
  workers: 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'es-ES',
    timezoneId: 'America/New_York',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],

  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
