import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    channel: 'chrome',
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
