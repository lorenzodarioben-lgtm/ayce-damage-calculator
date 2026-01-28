import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    /*
     * The component suites drive whole pages through userEvent in jsdom, and a
     * report now carries a scenario table and a replay alongside the meal
     * itself. The default five seconds is a timer on the environment rather
     * than on the code, so it is raised to something a loaded CI runner can
     * meet without any suite being made less strict.
     */
    testTimeout: 20_000,
    css: false,
  },
});
