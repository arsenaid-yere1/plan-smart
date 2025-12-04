import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        // Exclude unused adapters and type-only files
        '**/auth0-adapter.ts',
        '**/types.ts',
        // Exclude schema index (just re-exports)
        'src/db/schema/index.ts',
        // Exclude migration files
        'src/db/migrate.ts',
        // Exclude middleware files (tested via E2E)
        'src/middleware.ts',
        'src/middleware/**',
        // Exclude app pages (tested via E2E)
        'src/app/**/*.tsx',
        // Exclude components (would need component testing)
        'src/components/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
