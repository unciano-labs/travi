import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests: pure logic only (no network, no database). See tests/unit/.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // A zone that is neither UTC nor Manila, so date helpers that leak the process time zone fail.
    env: { TZ: 'America/New_York' },
    restoreMocks: true,
  },
});
