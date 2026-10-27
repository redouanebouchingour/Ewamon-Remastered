import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';
import base from './vitest.config';

/** File-name order (act1 < act2 < act3a < act3b < act3c < halls): each leg reads the fixture the previous one wrote. */
class LegOrder extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0));
  }
}

/**
 * The Phase B progression walk (packages/server/test/progression-*.test.ts): one headless account plays Acts I–III
 * through the real server — REST + the zone room, real movement inputs, every crossing a handover, every gym hall,
 * every story battle and all 12 league fights. Movement is real-time bound (the room refills the input budget per
 * 50 ms tick), so a leg takes tens of minutes; it lives here instead of the default `pnpm test` run.
 *
 *   pnpm test:progression                                   # every leg (they read each other's fixtures, so: one at a time)
 *   pnpm test:progression progression-act2                  # one leg, from fixtures/progression/act1.json
 *   EWA_PROGRESSION_WRITE=1 pnpm test:progression progression-act1   # re-record the leg's end fixture
 *   EWA_WALK_LOG=<file>                                     # live trace of the walk (zone, beats, fights)
 *
 * Legs run sequentially in file-name order (act1 → act2 → act3a → act3b → act3c), each starting from the fixture
 * the previous leg wrote.
 */
// the aliases only (mergeConfig would concatenate the default run's exclude list, which names these files)
export default defineConfig({
  resolve: base.resolve,
  test: {
    include: ['packages/server/test/progression-*.test.ts'],
    globalSetup: ['./vitest.setup-db.ts'],
    fileParallelism: false,
    sequence: { sequencer: LegOrder },
    environment: 'node',
    reporters: 'default',
    testTimeout: 7_200_000,
    hookTimeout: 300_000,
  },
});
