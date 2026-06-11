import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // lib/data.ts imports 'server-only', which throws outside a React Server
      // environment — stub it out for unit tests.
      'server-only': path.resolve(ROOT, 'test/stubs/server-only.ts'),
      '@': ROOT,
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      TERMO_DATA_DIR: path.resolve(ROOT, 'test/fixtures/data'),
    },
  },
});
