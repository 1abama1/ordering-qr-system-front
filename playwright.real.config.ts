import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: 'real.spec.ts',
  timeout: 90000,
  use: { ...base.use, trace: 'off', video: 'off' },
});
