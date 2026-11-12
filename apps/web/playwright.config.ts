import { defineConfig, devices } from '@playwright/test';

// 8 GB machine: one worker, Chromium only (AGENTS.md §9). The API must already be running
// (`./scripts/dev.sh start`); Playwright starts only the Vite dev server if it is not up.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results',
  // Visual baselines show real footage → kept in the workspace footage folder, never in this repo.
  snapshotPathTemplate: '{testDir}/../../../../footage/baselines/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: process.env.MYVIDEO_WEB_URL ?? 'http://127.0.0.1:5180',
    trace: 'retain-on-failure',
    locale: 'th-TH',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
