import { defineConfig } from 'vitest/config';

/**
 * A second, tiny vitest project for the lint tooling.
 *
 * The root config collects `packages/<pkg>/test/**` on purpose - that is the game's test suite and
 * its count is a number people watch. These tests are about the build's guard rails, run from
 * `pnpm test:lint-rules`, and would otherwise need the root include pattern widened to reach
 * a directory that is not a package.
 *
 * The end-to-end cases boot typescript-eslint's project service, which reads the real tsconfig
 * graph, so they are slower than a unit test and get a longer timeout.
 */
export default defineConfig({
  test: {
    include: ['eslint/*.test.js'],
    environment: 'node',
    testTimeout: 60_000,
    reporters: 'default',
  },
});
