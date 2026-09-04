import { defineConfig } from '@playwright/test';

// E2E runs against a production build over the REAL data bundle.
// Run `node scripts/fetch-data.mjs` (with DATA_BUNDLE_PATH if local) BEFORE
// `npm run e2e` — the webServer below skips the fetch (SKIP_DATA_FETCH=1)
// so the explicit fetch step stays the single source of data.
/**
 * The app poll opens a modal that covers the page on /strada/ and /punct-termic/
 * after a delay. In the test build that delay is pushed far out of reach, so an
 * unrelated spec visiting a street page can never race it — app-poll.spec.ts
 * fakes the clock and fast-forwards past this value instead of waiting.
 */
export const POLL_DELAY_MS = 600_000;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    env: { SKIP_DATA_FETCH: '1', NEXT_PUBLIC_APP_POLL_DELAY_MS: String(POLL_DELAY_MS) },
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
