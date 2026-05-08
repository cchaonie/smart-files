import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: path.resolve(__dirname, '.env') });

// Environment configuration map
const envConfigMap = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:4000',
  },
  staging: {
    baseURL: process.env.STAGING_URL || 'https://staging.smart-files.app',
    apiURL: process.env.STAGING_API_URL || 'https://api-staging.smart-files.app',
  },
  production: {
    baseURL: process.env.PROD_URL || 'https://smart-files.app',
    apiURL: process.env.PROD_API_URL || 'https://api.smart-files.app',
  },
};

const environment = (process.env.TEST_ENV as keyof typeof envConfigMap) || 'local';

if (!envConfigMap[environment]) {
  console.error(`❌ No configuration found for environment: ${environment}`);
  console.error(`   Available environments: ${Object.keys(envConfigMap).join(', ')}`);
  process.exit(1);
}

console.log(`✅ Running tests against: ${environment.toUpperCase()}`);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Standardized timeouts
  timeout: 60000,
  expect: { timeout: 10000 },

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],

  use: {
    baseURL: envConfigMap[environment].baseURL,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Local dev server
  webServer: environment === 'local' ? {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
});
