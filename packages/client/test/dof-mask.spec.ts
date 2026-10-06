/**
 * §50.1 #7 / §50.4.7 `dof-mask.spec.ts` (Phase E5) — DOF never touches the player or an active battler: the scene
 * pass's `mask` MRT (y = DOF-sharp, the channel the tilt-shift DOF reads its CoC through) reads exactly 1.0 over their
 * whole visible silhouette in every frame of a 600-frame capture — 300 overworld frames on the player's figure (moved
 * to a new spot every 60 frames, the camera following) and 300 frames of the scripted `mire_route` wild battle (the
 * §50.6.1 shot-5 staging, then the timeline playing on) on both active battlers. Any value < 1.0 fails; so does a
 * DOF-sharp bit ≠ 1 or a subject the readback could not see. The page (`dof-mask/`) boots the offline HarnessWorld
 * under the Vite dev server — no game server needed. Silhouette method and the two explained exceptions (a pixel
 * covered only in the tick frame; an alpha-test hole a billboard did not draw): see `dof-mask/main.ts`.
 */
import { expect, test } from '@playwright/test';
import { freePort, serveDev } from './e2e/stack';
import type { DofReport } from './dof-mask/main';

let origin = '';
let server: { close(): Promise<void> } | null = null;

test.beforeAll(async () => {
  const port = await freePort();
  server = await serveDev(port);
  origin = `http://127.0.0.1:${port}`;
});
test.afterAll(async () => {
  await server?.close();
});

test('the DOF mask reads 1.0 over the player and both active battlers in 600 frames', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/test/dof-mask/index.html`);
  await expect
    .poll(async () => page.evaluate(() => { const d = (window as unknown as { __dof?: { ready: boolean; error: string | null } }).__dof; return d?.error ?? d?.ready ?? false; }), { timeout: 300_000, intervals: [1000] })
    .toBe(true);
  const report = await page.evaluate(() => (window as unknown as { __dof: { run(o: { overworldFrames: number; battleFrames: number }): Promise<unknown> } }).__dof.run({ overworldFrames: 300, battleFrames: 300 })) as DofReport;
  const sil = (name: string): number[] => report.checked.flatMap((r) => r.subjects.filter((s) => s.name === name).map((s) => s.silhouette));
  const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  const transient = report.checked.reduce((a, r) => a + r.subjects.reduce((b, s) => b + s.transient, 0), 0);
  console.log(`dof-mask: ${report.frames} frames; median silhouette px — player ${med(sil('player'))}, battler-player ${med(sil('battler-player'))}, battler-foe ${med(sil('battler-foe'))}; explained transient px over all frames ${transient}`);
  expect(report.frames).toBe(600);
  expect(report.failures, report.log.slice(-20).join('\n')).toEqual([]);
  expect(report.ok).toBe(true);
  expect(errors).toEqual([]);
});
