import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // subpath first: vite matches '@ewa/render' as a prefix of '@ewa/render/surfaces' otherwise
      '@ewa/render/surfaces': fileURLToPath(new URL('./packages/render/src/surfaces/index.ts', import.meta.url)),
      '@ewa/core': pkg('core'),
      '@ewa/content': pkg('content'),
      '@ewa/protocol': pkg('protocol'),
      '@ewa/persist': pkg('persist'),
      '@ewa/render': pkg('render'),
      '@ewa/server': pkg('server'),
    },
  },
  test: {
    // Packages that can run against a real Postgres (DATABASE_URL) share one database, so their
    // test files must not run in parallel workers. PGlite (the default) is per-file in-memory.
    fileParallelism: !process.env.DATABASE_URL,
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'tools/*/test/**/*.test.ts'],
    // tools/character-pipeline (the pixel-art characters) is superseded by the KayKit 3D set (render §10.7.7,
    // 2026-10-05): its output is no longer shipped, so its budget tests leave the default run
    exclude: [...configDefaults.exclude, 'tools/character-pipeline/**'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
