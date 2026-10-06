/**
 * §50.4.7 `first-frame.spec.ts` (Phase E5; legacy-render-audit Q17, §20.10.3). This is a cold start of the production
 * build (`vite build`, served with an `/api` proxy by `e2e/stack.ts`) against a real server:
 * - An account registered through the form opens `/play` in a fresh page.
 * - The network is throttled to 50 Mbit/s and the HTTP cache is disabled.
 * - The world reveals the canvas on its first rendered frame (`performance.mark('ewa:first-frame')`, World3D).
 *
 * Asserted:
 * - The bytes fetched before the mark stay inside §20.10.3's phase budgets: `field` materials ≤ 6 MB; creature
 *   atlases + singles + GLB ≤ 4 MB.
 * - The `hero` material tier and audio are not awaited. Every hero / audio request is held unanswered until the mark
 *   has landed, and the mark still lands, with the zone loaded.
 * - The mark lands ≤ 2 500 ms after navigation start on `mirevale`. Like `handover-hitch.spec.ts`, this millisecond
 *   limit is asserted only with `EWA_REFERENCE_GPU=1`, on the §50.2 reference machine. Elsewhere the measured time is
 *   attached as an annotation.
 */
import { expect, test } from '@playwright/test';
import { debug, registerAndEnter, uniqueName, until } from './e2e/game';
import { startStack } from './e2e/stack';
import type { Stack } from './e2e/stack';

test.use({ actionTimeout: 30_000 });

const MB = 1024 * 1024;
const FIRST_FRAME_MS = 2_500;
const REFERENCE = process.env['EWA_REFERENCE_GPU'] === '1';

let stack: Stack;
test.beforeAll(async () => {
  test.setTimeout(600_000);
  stack = await startStack({ client: 'build' });
});
test.afterAll(async () => {
  await stack?.stop();
});

interface Res { readonly name: string; readonly start: number; readonly end: number; readonly bytes: number }

test('first frame on mirevale at 50 Mbit/s, cold cache: phase byte budgets, hero + audio not awaited, ≤ 2.5 s on the reference GPU', async ({ browser }) => {
  test.setTimeout(600_000);
  // register (unthrottled); the same context keeps the refresh token for the measured navigation
  const { page: reg } = await registerAndEnter(browser, stack, uniqueName('first'));
  const ctx = reg.context();
  await reg.close();

  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // hold every hero-tier texture and audio file until the first frame: if the mark waited on one, it would never land
  let release: () => void = () => {};
  const firstFrameSeen = new Promise<void>((res) => { release = res; });
  const held: string[] = [];
  await page.route((url) => /\/materials\/[^/]+\.hero_|\/audio\/.+\.(ogg|mp3|wav|opus|webm)$/.test(url.pathname), async (route) => {
    held.push(new URL(route.request().url()).pathname);
    await firstFrameSeen;
    await route.continue().catch(() => undefined);
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: (50 * 1e6) / 8, uploadThroughput: (50 * 1e6) / 8 });
  await page.goto(`${stack.origin}/play?dev=1`);
  try {
    await until(page, 'the first frame (hero tier and audio held)', (d) => d.firstFrame && d.zone === 'mirevale', 300_000);
  } finally {
    release();
  }

  const m = await page.evaluate(() => {
    const mark = performance.getEntriesByName('ewa:first-frame')[0];
    const res = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((r) => ({
      name: new URL(r.name).pathname,
      start: r.startTime,
      end: r.responseEnd,
      bytes: r.encodedBodySize || r.transferSize,
    }));
    return { mark: mark === undefined ? null : mark.startTime, res };
  });
  expect(m.mark, 'performance.mark(ewa:first-frame) missing').not.toBeNull();
  const mark = m.mark!;
  const before = (r: Res): boolean => r.end > 0 && r.end <= mark;
  const sum = (f: (r: Res) => boolean): number => m.res.filter((r) => before(r) && f(r)).reduce((a, r) => a + r.bytes, 0);
  const field = sum((r) => r.name.startsWith('/materials/') && r.name.includes('.field_'));
  const sprites = sum((r) => r.name.startsWith('/creatures/') || r.name.startsWith('/models/'));
  const heroBefore = m.res.filter((r) => before(r) && r.name.includes('.hero_')).map((r) => r.name);
  const summary = `mark ${Math.round(mark)} ms; before it: field materials ${(field / MB).toFixed(2)} MB, atlases+singles+GLB ${(sprites / MB).toFixed(2)} MB, ${m.res.filter(before).length} resources; ${held.length} hero / audio requests held until the mark`;
  console.log(`first-frame: ${summary}`);
  test.info().annotations.push({ type: 'first-frame', description: summary });

  expect(field, 'field materials before the first frame').toBeLessThanOrEqual(6 * MB);
  expect(sprites, 'atlases + singles + GLB before the first frame').toBeLessThanOrEqual(4 * MB);
  // held requests cannot have completed before the mark: the mark did not wait for them
  expect(heroBefore, 'hero tier completed before the first frame').toEqual([]);
  expect(held.some((p) => p.includes('.hero_')), 'the hero stream was requested (phase 5 / the zone hero gate)').toBe(true);
  expect((await debug(page))?.zoneLoaded).toBe(true);
  if (REFERENCE) expect(mark, `first frame at ${Math.round(mark)} ms`).toBeLessThanOrEqual(FIRST_FRAME_MS);
  else if (mark > FIRST_FRAME_MS) test.info().annotations.push({ type: 'SPEC threshold not asserted (EWA_REFERENCE_GPU unset)', description: `first frame ${Math.round(mark)} ms > ${FIRST_FRAME_MS} ms` });
  expect(errors).toEqual([]);
});
