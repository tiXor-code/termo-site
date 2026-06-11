import { defineConfig } from '@playwright/test';

// E2E runs against a production build over the REAL data bundle.
// Run `node scripts/fetch-data.mjs` (with DATA_BUNDLE_PATH if local) BEFORE
// `npm run e2e` — the webServer below skips the fetch (SKIP_DATA_FETCH=1)
// so the explicit fetch step stays the single source of data.
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
    env: { SKIP_DATA_FETCH: '1' },
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
