/**
 * §50.5 M3 progression walk, leg 2 of 5 (progression.ts): from the snapshot leg 1 wrote (tide_route, 3 badges,
 * Act I done) to siege_route — beats 10–23 of Act II, Zia Volt, Petra Stonewright, Nyx Hollow, Marshal Rell, the
 * Observatory chain (holding, ledger, Sable's turn, the escort out, the stair warp), the Forgewall siege, and the
 * statics raikitsune (badge:circuit), galaxion (flag:ledger_read) and bankaiser (badge:anvil).
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TestServer } from './helpers';
import { assertMe, expectLocked, finishLeg, nearEdge, playBeat, report, startLeg, walkServer, winLeague, winStatic } from './progression';

let s: TestServer;
beforeAll(async () => {
  s = await walkServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

it('act2: tide_route → siege_route — beats 10–23, circuit / fault / wraith / anvil, three statics', async () => {
  const t0 = Date.now();
  const w = await startLeg(s, 'act1');
  try {
    // ── stormrook: Zia's numbers first (her gate), then the grind on Tide Route, then the badge ──
    // (the gate beat's speaker is Zia herself and Act I is done, so facing her plays it first: §30.4.8 step 1)
    await w.cross('e');
    await playBeat(w, 'grid_numbers');
    await w.buy('spark_orb', 8);
    await w.cross('w');
    await nearEdge(w, 'e');
    await w.train(30, 'e');
    await w.cross('e');
    await winLeague(w, 'volt_gym');
    await w.cross('e');
    // ── galvan_route: the lineman, a partner, the struck pylon ──
    await playBeat(w, 'the_lineman');
    await w.catchOne('shardling', 'spark_orb');
    await nearEdge(w, 'w');
    await w.train(35, 'w');
    await winStatic(w, 'raikitsune', 'w');
    await w.cross('e');
    // ── marrowdig ──
    await playBeat(w, 'the_seam');
    await winLeague(w, 'stone_gym');
    await playBeat(w, 'fault_after');
    await w.cross('e');
    // ── deepcut_route ──
    await playBeat(w, 'sable_refuses', { target: 'sable_deepcut', heal: 'w' });
    await nearEdge(w, 'e');
    await w.train(40, 'e');
    await w.cross('e');
    // ── vesperveil: Nyx waits for the medium's reading ──
    await expectLocked(w, 'phantom_gym');
    await playBeat(w, 'grove_gone');
    await winLeague(w, 'phantom_gym');
    await playBeat(w, 'wraith_after');
    await w.cross('n');
    // ── umbral_observatory: the chain, the stair warp, two story battles, the star at the lens ──
    await nearEdge(w, 's');
    await w.train(50, 's');
    await playBeat(w, 'the_holding');
    await w.goTo('warp', 'umbral_observatory.stair');
    const warped = await w.interact('warp', 'umbral_observatory.stair');
    expect(warped.filter((m) => m.type === 'error')).toEqual([]);
    await playBeat(w, 'the_ledger');
    await playBeat(w, 'sables_turn', { target: 'sable_observatory', heal: 's' });
    await playBeat(w, 'escorted_out', { target: 'reeve_observatory', heal: 's' });
    await winStatic(w, 'galaxion', 's');
    await w.cross('s');
    await w.cross('e');
    await w.cross('e');
    // ── forgewall: the requisition, the siege, the Anvil Badge, the vault ──
    await playBeat(w, 'the_requisition');
    await playBeat(w, 'siege_of_forgewall', { target: 'hollis_siege' });
    await winLeague(w, 'iron_gym');
    await winStatic(w, 'bankaiser', 'here');
    await w.cross('e');
    // ── siege_route ──
    await playBeat(w, 'sable_beside');
    await assertMe(w, { badges: 7, champion: false });
    expect(w.stats.desyncs).toBe(0);
    await finishLeg(w, 'act2');
  } finally {
    console.log(report(w, 'act2', t0));
  }
}, 2_400_000);
