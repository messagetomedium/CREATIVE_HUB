import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const executablePath =
  process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
    },
  },
  webServer: {
    command:
      'npm run content:build && npm run dev --workspace @creative-factory/web -- --port 5180',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    // Test-only public configuration. Requests are intercepted by the fixture, never sent to Auth.
    env: {
      VITE_SUPABASE_URL: 'https://creative-factory-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture_only',
      VITE_AUTH_OTP_EXPIRY_SECONDS: '600',
      VITE_AUTH_OTP_LENGTH: '6',
    },
    timeout: 30000,
  },
});
