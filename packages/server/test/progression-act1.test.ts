/**
 * §50.5 M3 progression walk, leg 1 of 5 (progression.ts): a fresh account, mirevale → tide_route, beats 1–9 of
 * Act I, Grove-Keeper Mira, Karn Emberlitt, Captain Maren — every step through REST + the zone room, every crossing
 * a real handover; every gym is fought in its hall (Phase A: door warp, gym trainers, the hall's puzzle, per-player
 * gates). The story gates are exercised on the way: Karn before `forge_gratitude` (Cinderhold comes before Ash
 * Route, so the player has to come back — his hall is cleared on the first visit), Maren before `drowned_harbour`.
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

it('act1: mirevale → tide_route — beats 1–9, bloom / ember / current, through the room', async () => {
  const t0 = Date.now();
  const w = await startLeg(s, null);
  try {
    // ── mirevale ──
    await w.buy('spark_orb', 12);
    await playBeat(w, 'first_witness');
    // (Phase A: Mira waits behind her hall's gates — two gym trainers at L8–10 a fresh L5 starter cannot pass — and
    // her story gate `saw_thinning` is her own beat `grove_stone`, which plays the moment she is in reach; so her
    // refusal is never observable on foot. gates-reachable.test + battle-room.test pin it; Karn and Maren below.)
    await w.cross('e');
    // ── mire_route: the fire starter grinds on the grass it beats, takes two partners, then faces Sable ──
    await nearEdge(w, 'w');
    await w.train(9, 'w');
    await w.catchOne('smellduck', 'spark_orb');
    await w.catchOne('mufflo', 'spark_orb');
    // Sable's Coalette has Flash Fire (abilities[0]): the expected-damage player answers with Tackle, not fire
    const rival = await playBeat(w, 'mire_rival', { target: 'sable_mire', heal: 'w' });
    expect(rival!.start.state.sides[1].party[0]!.creature.ability).toBe('Flash Fire');
    await nearEdge(w, 'w');
    await w.train(16, 'w');
    await w.cross('w');
    // ── mirevale: the stone, the gym, the badge beat ──
    await playBeat(w, 'grove_stone');
    await winLeague(w, 'verdant_gym');
    await playBeat(w, 'bloom_after');
    await w.buy('spark_orb', 6);
    await w.cross('e');
    await w.cross('e');
    // ── cinderhold: Karn waits for the Grey Year beat, which waits for Ash Route ──
    await expectLocked(w, 'blaze_gym');
    await w.cross('e');
    // ── ash_route ──
    await playBeat(w, 'first_harvest');
    await w.catchOne('pebfist', 'spark_orb');
    await nearEdge(w, 'w');
    await w.train(21, 'w');
    await w.cross('w');
    // ── cinderhold ──
    await playBeat(w, 'forge_gratitude');
    await winLeague(w, 'blaze_gym');
    await w.cross('e');
    await w.cross('e');
    // ── saltmourn: Maren waits for the harbourmaster's chart ──
    await expectLocked(w, 'tidal_gym');
    await playBeat(w, 'drowned_harbour');
    await w.buy('spark_orb', 6);
    await w.cross('w');
    await nearEdge(w, 'e');
    await w.train(25, 'e');
    await w.cross('e');
    await winLeague(w, 'tidal_gym');
    await playBeat(w, 'current_after');
    await w.cross('e');
    // ── tide_route: Sable in the grey coat ──
    await playBeat(w, 'sable_livery', { target: 'sable_tide', heal: 'w' });
    await w.catchOne('shiveruff', 'spark_orb');
    await assertMe(w, { badges: 3, champion: false });
    expect(w.stats.desyncs).toBe(0);
    await finishLeg(w, 'act1');
  } finally {
    console.log(report(w, 'act1', t0));
  }
}, 1_800_000);
