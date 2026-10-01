/**
 * §50.5 M3 progression walk, leg 3 of 5 (progression.ts): from the snapshot leg 2 wrote (siege_route, 7 badges, Act
 * II done) to Solenne with the title — Sylvane, the shrine, the Permanence notice, the Spire withdrawal, the
 * capital thinning, Kirei's charge (the Wardens' story gate), Veil, Aurelia, Kirei, Champion Zeon, the name, the new
 * column. Ends with the M3 box's check: GET /me shows 8 badges and flags containing `champion:zeon:beaten`.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TestServer } from './helpers';
import { assertMe, expectLocked, finishLeg, nearEdge, playBeat, report, startLeg, walkServer, winLeague } from './progression';

let s: TestServer;
beforeAll(async () => {
  s = await walkServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

it('act3a: siege_route → solenne — ascend, the Spire, the Wardens and the Champion (GET /me: 8 badges + champion flag)', async () => {
  const t0 = Date.now();
  const w = await startLeg(s, 'act2');
  try {
    // ── skyrend ──
    await w.cross('e');
    await playBeat(w, 'star_counts');
    await winLeague(w, 'draco_gym');
    await w.cross('e');
    await w.cross('e');
    // ── eclipse_shrine ──
    await playBeat(w, 'shrine_of_first_night');
    await w.cross('e');
    // ── solenne: the notice; the Wardens wait for their charge ──
    await playBeat(w, 'permanence_notice');
    await expectLocked(w, 'veil');
    await w.cross('n');
    // ── celestial_spire: the grind, then the withdrawal ──
    await nearEdge(w, 's');
    await w.train(58, 's');
    await playBeat(w, 'spire_withdrawal', { target: 'varn_spire', heal: 's' });
    await w.train(63, 's');
    await w.cross('s');
    // ── solenne: the capital thinning, Kirei's charge, the league, the name, the column ──
    await playBeat(w, 'capital_thinning');
    await playBeat(w, 'wardens_charge');
    await winLeague(w, 'veil');
    await winLeague(w, 'aurelia');
    await winLeague(w, 'kirei');
    await winLeague(w, 'zeon');
    await playBeat(w, 'name_restored');
    await playBeat(w, 'the_new_column');
    await assertMe(w, { badges: 8, champion: true });
    expect(w.stats.desyncs).toBe(0);
    await finishLeg(w, 'act3a');
  } finally {
    console.log(report(w, 'act3a', t0));
  }
}, 2_400_000);
