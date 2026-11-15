import { defineConfig, devices } from '@playwright/test'

const port = 4321

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}/DebugLab/`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serve the production build the way GitHub Pages does, so deep-link tests are honest.
  webServer: {
    command: `npm run build && node scripts/serve-pages.mjs ${port}`,
    url: `http://localhost:${port}/DebugLab/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
