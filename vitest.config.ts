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
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'tools/*/test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
