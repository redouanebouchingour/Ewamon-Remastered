import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ewa/core': pkg('core'),
      '@ewa/content': pkg('content'),
      '@ewa/protocol': pkg('protocol'),
      '@ewa/persist': pkg('persist'),
      '@ewa/render': pkg('render'),
      '@ewa/server': pkg('server'),
      '@ewa/render/surfaces': fileURLToPath(new URL('./packages/render/src/surfaces/index.ts', import.meta.url)),
    },
  },
  test: {
    // Packages that can run against a real Postgres (DATABASE_URL) share one database, so their
    // test files must not run in parallel workers. PGlite (the default) is per-file in-memory.
    fileParallelism: !process.env.DATABASE_URL,
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'tools/*/test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
