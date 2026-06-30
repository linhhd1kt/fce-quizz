import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {},
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        external: ['canvas', '@napi-rs/canvas', 'pdfjs-dist'],
      },
    },
  },
});
