/**
 * §50.5 M3 progression walk, leg 5 of 5 (progression.ts): from the snapshot leg 4 wrote (the Rift) home — the
 * statics voltaura (galvan_route) and sunjaw (ash_route), then beat 27 `restore_the_grove` on Mire Route (its data
 * needs only `act3_started ledger_read`, so a player may leave it for the way home). The walk's final state: all 33
 * beats done, 8 badges, the champion flag, all 8 statics' flags, every league row beaten.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LEAGUE, LEGENDARY_STATICS, harvestStateFor } from '@ewa/content';
import { api } from './helpers';
import type { TestServer } from './helpers';
import { allBeatsDone, assertMe, finishLeg, playBeat, report, startLeg, walkServer, winStatic } from './progression';

let s: TestServer;
beforeAll(async () => {
  s = await walkServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

it('act3c: the_rift → mire_route — voltaura, sunjaw, restore_the_grove; the whole world done', async () => {
  const t0 = Date.now();
  const w = await startLeg(s, 'act3b');
  try {
    await w.cross('n');
    await w.cross('w');
    await winStatic(w, 'voltaura', 'e');
    for (const _zone of ['stormrook', 'tide_route', 'saltmourn', 'ash_route']) await w.cross('w');
    await winStatic(w, 'sunjaw', 'e');
    await w.cross('w');
    await w.cross('w');
    await playBeat(w, 'restore_the_grove');

    await assertMe(w, { badges: 8, champion: true });
    const me = await api(s, 'GET', '/me', w.access);
    const flags = me.body.flags as string[];
    expect(me.body.badges).toEqual(['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend']);
    // the three Wardens and the Champion, as the client sees them on GET /me
    for (const f of ['elite:veil:beaten', 'elite:aurelia:beaten', 'elite:kirei:beaten', 'champion:zeon:beaten']) expect(flags).toContain(f);
    expect(allBeatsDone(flags)).toEqual([]);
    for (const st of LEGENDARY_STATICS) expect(flags).toContain(st.flag);
    for (const lt of LEAGUE) for (const f of lt.setsFlags) expect(flags).toContain(f);
    const set = new Set(flags);
    expect(harvestStateFor('mire_route', set)).toBe('intact');
    expect(harvestStateFor('ash_route', set)).toBe('harvested');
    expect(harvestStateFor('solenne', set)).toBe('intact');
    expect(w.stats.desyncs).toBe(0);
    await finishLeg(w, 'act3c');
  } finally {
    console.log(report(w, 'act3c', t0));
  }
}, 2_400_000);
