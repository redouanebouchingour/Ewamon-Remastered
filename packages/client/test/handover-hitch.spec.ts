/**
 * SPEC §50.4.7 `handover-hitch.spec.ts` (Playwright, two zones; §20.10.3, spine §4.6, legacy-render-audit Q16):
 * crossing `mirevale → mire_route` — with `mire_route` preloaded: no frame > 33 ms, no full-screen fade, first
 * destination frame ≤ 250 ms after `handoverAck`; not preloaded: ≤ 1 500 ms.
 *
 * Runs the capture harness page (`/harness/shots?zone=mirevale&bg=1`: the real renderer, SceneDirector, zone adapter
 * with the neighbour skirt, background compile on as in the client) served from a fresh `vite build` of the harness
 * input, in the system Chrome with WebGPU. `__ewaHarness.handover(to, { preload })` crosses the way World3D does
 * (`director.loadZone` with the arrival focus, `renderer.prepareHandover` keeping the shared texture sets) while a
 * requestAnimationFrame loop ticks the world and records every frame gap.
 *
 * The millisecond thresholds are the SPEC's for the reference machine (RTX 3060 class, §50.2): they are asserted when
 * `EWA_REFERENCE_GPU=1`. On any other machine the measured numbers are attached (`handover-*.json`) and annotated, and
 * only the structural checks hold (the zone changed, the destination rendered, no fade). Run:
 * `npx playwright test packages/client/test/handover-hitch.spec.ts`.
 */
import { expect, test } from '@playwright/test';
import { buildHarness, freePort, serveBuild } from '../scripts/harness/common';
import type { PageServer } from '../scripts/harness/common';
import type { HandoverResult } from '../src/harness/HarnessWorld';

const REFERENCE = process.env['EWA_REFERENCE_GPU'] === '1';

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-webgpu-developer-features', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] },
});

let server: PageServer | null = null;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  await buildHarness();
  server = await serveBuild(await freePort(5241));
});

test.afterAll(async () => {
  await server?.close();
  server = null;
});

interface HarnessWindow { __ewaHarness?: { ready: boolean; error: string | null; handover(to: string, o: { preload: boolean }): Promise<HandoverResult> } }

for (const preload of [true, false]) {
  test(`mirevale → mire_route handover (${preload ? 'preloaded' : 'not preloaded'})`, async ({ page }) => {
    test.setTimeout(1_200_000);
    await page.goto(`${server!.origin}/harness/shots?zone=mirevale&bg=1`);
    await page.waitForFunction(() => { const h = (window as unknown as HarnessWindow).__ewaHarness; return h !== undefined && (h.ready || h.error !== null); }, null, { timeout: 900_000, polling: 1000 });
    const error = await page.evaluate(() => (window as unknown as HarnessWindow).__ewaHarness!.error);
    expect(error).toBeNull();
    const r = await page.evaluate((p) => (window as unknown as HarnessWindow).__ewaHarness!.handover('mire_route', { preload: p }), preload);
    await test.info().attach(`handover-${preload ? 'preloaded' : 'cold'}.json`, { body: JSON.stringify(r, null, 2), contentType: 'application/json' });
    console.log(`[handover-hitch] ${JSON.stringify(r)}`);
    expect(r.zone).toBe('mire_route');
    expect(r.firstFrameMs).not.toBeNull();
    expect(r.fade).toBe(false);
    const limit = preload ? 250 : 1500;
    if (REFERENCE) {
      expect(r.firstFrameMs!).toBeLessThanOrEqual(limit);
      if (preload) expect(r.framesOver33).toBe(0);
    } else {
      test.info().annotations.push({
        type: 'not the reference GPU',
        description: `SPEC thresholds not asserted (EWA_REFERENCE_GPU unset): first destination frame ${r.firstFrameMs} ms (SPEC ≤ ${limit}), load ${r.loadMs} ms, max frame ${r.maxFrameMs} ms, ${r.framesOver33} of ${r.frames} frames > 33 ms`,
      });
    }
  });
}
