import { defineConfig } from 'vitest/config';
import path from 'path';

// Standalone vitest config — intentionally does NOT load the app's vite plugins
// (jsx-loc / manus runtime) so the game-logic unit tests run fast in pure Node.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['client/src/**/*.{test,spec}.ts'],
    setupFiles: ['./client/src/game/__tests__/setup.ts'],
  },
});
