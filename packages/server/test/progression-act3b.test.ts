/**
 * §50.5 M3 progression walk, leg 4 of 5 (progression.ts): from the snapshot leg 3 wrote (Solenne, the title) back
 * west to Marrowdig and down into the Rift — beat 33 `rift_edge`, and the post-title statics zenryu (eclipse_shrine),
 * glacinid (ascent_route) and voidraxis (the_rift), each gated on `champion:zeon:beaten`.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TestServer } from './helpers';
import { finishLeg, nearEdge, playBeat, report, startLeg, walkServer, winStatic } from './progression';

let s: TestServer;
beforeAll(async () => {
  s = await walkServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

it('act3b: solenne → the_rift — rift_edge and the statics zenryu, glacinid, voidraxis', async () => {
  const t0 = Date.now();
  const w = await startLeg(s, 'act3a');
  try {
    await w.cross('w');
    await winStatic(w, 'zenryu', 'e');
    await w.cross('w');
    await winStatic(w, 'glacinid', 'w');
    for (const _zone of ['skyrend', 'siege_route', 'forgewall', 'hollow_route', 'vesperveil', 'deepcut_route', 'marrowdig']) await w.cross('w');
    await w.cross('s');
    await playBeat(w, 'rift_edge');
    await nearEdge(w, 'n');
    await w.train(66, 'n');
    await winStatic(w, 'voidraxis', 'n');
    expect(w.stats.desyncs).toBe(0);
    await finishLeg(w, 'act3b');
  } finally {
    console.log(report(w, 'act3b', t0));
  }
}, 2_400_000);
