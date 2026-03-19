import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Use the browser-like environment so sessionStorage is available
    environment: 'jsdom',
    globals: true,
    // Resolve bare imports from www/js so test files can import modules
    // exactly as the browser would (e.g. import { getCheckout } from '../www/js/checkout.js')
    include: ['unit/**/*.test.js', 'security/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['../www/js/**/*.js'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../www/js'),
    },
  },
});
