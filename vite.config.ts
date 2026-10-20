import { createLogger } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { redactSensitiveUrl } from './src/shared/lib/redact.ts';
const logger = createLogger();
const customLogger = {
  ...logger,
  info: (message: string, options?: Parameters<typeof logger.info>[1]) =>
    logger.info(redactSensitiveUrl(message), options),
  warn: (message: string, options?: Parameters<typeof logger.warn>[1]) =>
    logger.warn(redactSensitiveUrl(message), options),
  error: (message: string, options?: Parameters<typeof logger.error>[1]) =>
    logger.error(redactSensitiveUrl(message), options),
  warnOnce: (
    message: string,
    options?: Parameters<typeof logger.warnOnce>[1],
  ) => logger.warnOnce(redactSensitiveUrl(message), options),
};
export default defineConfig({
  customLogger,
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
