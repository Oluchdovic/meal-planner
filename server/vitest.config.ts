import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le code serveur est en ESM NodeNext : les imports internes portent une
  // extension `.js` alors que les fichiers sont des `.ts`. On réécrit ces
  // spécificateurs pour que Vite les résolve vers les sources TypeScript.
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
