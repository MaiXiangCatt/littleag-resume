import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['dist/**', 'e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
