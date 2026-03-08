import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    benchmark: {
      include: ['src/__tests__/**/*.bench.ts'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@services': '/src/services',
    },
  },
});