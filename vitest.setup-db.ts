/**
 * vitest globalSetup: names this run (`EWA_TEST_RUN`, a base-36 timestamp the workers inherit) so the scratch
 * databases its test files create can be told apart, then drops them at the end, together with any a crashed run left
 * behind. A run that never touches Postgres (core, content, render) needs no server: the teardown skips quietly.
 */
import process from 'node:process';
import { dropScratchDbs } from './packages/persist/src/scratch';

export function setup(): () => Promise<void> {
  const run = Date.now().toString(36);
  process.env['EWA_TEST_RUN'] = run;
  return () => dropScratchDbs(run);
}
