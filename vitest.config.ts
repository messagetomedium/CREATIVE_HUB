import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/game-server/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'supabase/tests/**/*.test.ts',
    ],
    testTimeout: 15000,
  },
});
