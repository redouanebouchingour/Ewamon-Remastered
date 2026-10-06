/**
 * §50.4.5 raid.test.ts + §30.11 + §30.5.1 #14.
 * Pure `RaidSession`: two participants → a deterministic boss HP after round 1 given the seed (ascending playerId
 * order); phases 0 → 1 → 2 (hpPct < 0.3, atk +2 once) → 3 → 4; one `raidCatch` per participant with damage > 0.
 * In a room: `hpPct` is the only boss HP a client sees (RaidState), `raidEvents` carry digests, rewards ride
 * `battleEnd { battleId: raidId }`, a replayed catch is refused with one orb spent, and the hotspot scheduler opens
 * the raid through the presence election.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { RAID_HOTSPOTS, getHeightfield, nearestWalkable } from '@ewa/content';
import type { RaidHotspot } from '@ewa/content';
import { TRAINER_EXP, calcMaxHp, createRng, digestBattleState } from '@ewa/core';
import type { Action, CreatureInstance } from '@ewa/core';
import { RaidState } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { RAID_CATCH_WINDOW_MS, RAID_ENRAGE_HP, RAID_MONEY_PER_LEVEL, RaidSession } from '../src/rooms/raidSession';
import type { RaidPhase } from '../src/rooms/raidSession';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { api, content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

function party(id: string, species: string, level: number): CreatureInstance[] {
  return [{ ...newCreature(content, species, level, { ownerId: id }), id: `00000000-0000-4000-8000-${id.slice(-12).padStart(12, '0')}` }];
}

const WEAK_BOSS: RaidHotspot = { id: 'test_raid', zoneId: 'mire_route', x: 0, z: 0, boss: { species: 'mossling', level: 5, hpMultiplier: 200 }, minBadges: 0, window: { utcHour: 0, minutes: 1440 } };

function firstMove(s: RaidSession, pid: string): Action {
  const side = s.participants.get(pid)!.state.sides[0];
  if (side.mustSwitch) return { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) };
  return { kind: 'move', move: side.party[side.active]!.creature.moves.find((m) => m.pp > 0)!.id };
}

describe('RaidSession (pure)', () => {
  it('boss HP = floor(calcMaxHp × hpMultiplier); the RaidState view has hpPct and no absolute HP', () => {
    const s = new RaidSession(WEAK_BOSS, createRng('r'), content, 0);
    expect(s.bossBattler.maxHp).toBe(Math.floor(calcMaxHp(content.species('mossling').baseHp, 5) * 200));
    const v = s.toState(0);
    expect(v.hpPct).toBe(1);
    expect(Object.keys(v).sort()).toEqual(['bossLevel', 'bossSpecies', 'damageBoard', 'hpPct', 'id', 'phase', 'roundEndsInMs', 'x', 'z']);
    const schemaKeys = Object.keys(new RaidState().toJSON());
    expect(schemaKeys.some((k) => /^(hp|maxHp|bossHp)$/i.test(k))).toBe(false);
  });

  it('two participants: the boss HP after round 1 is a function of the seed and the actions (ascending playerId order)', () => {
    const a = '00000000-0000-4000-8000-00000000000a';
    const b = '00000000-0000-4000-8000-00000000000b';
    const run = (seed: string, joinOrder: readonly string[]): { hp: number; order: readonly string[] } => {
      const s = new RaidSession(WEAK_BOSS, createRng(seed), content, 0);
      // participant seeds are forked in join order, so join order is part of the input — keep it fixed per run
      for (const pid of joinOrder) expect(s.join(pid, party(pid, pid === a ? 'bramblecub' : 'glimfin', 40), 0, 0)).toBe('ok');
      for (const pid of joinOrder) s.ready(pid);
      expect(s.tick(1)).toBe(true);
      expect(s.phase).toBe(1);
      for (const pid of joinOrder) expect(s.action(pid, 1, firstMove(s, pid))).toBeNull();
      const r = s.prepareRound();
      s.commitRound(r, 2);
      return { hp: s.bossBattler.creature.hp, order: r.order };
    };
    const x = run('seed-1', [a, b]);
    expect(run('seed-1', [a, b]).hp).toBe(x.hp);
    expect(x.order).toEqual([a, b]);
    expect(x.hp).toBeLessThan(new RaidSession(WEAK_BOSS, createRng('seed-1'), content, 0).bossBattler.maxHp);
    // b joining first still resolves a first (ascending id), only the forked seeds differ
    expect(run('seed-1', [b, a]).order).toEqual([a, b]);
  });

  it('phases 0 → 1 → 2 (hpPct < 0.3, atk +2 once, enrage event to everyone) → 3 → 4; one catch per participant with damage > 0', () => {
    const a = '00000000-0000-4000-8000-0000000000a1';
    const idle = '00000000-0000-4000-8000-0000000000a2';
    const s = new RaidSession(WEAK_BOSS, createRng('phases'), content, 0);
    s.join(a, party(a, 'bramblecub', 60), 0, 0);
    s.join(idle, party(idle, 'glimfin', 60), 0, 0);
    expect(s.join(a, party(a, 'bramblecub', 60), 0, 0)).toBe('already');
    expect(s.catchAttempt(a, 'spark_orb')).toBe('notParticipant'); // no damage yet
    const seen: RaidPhase[] = [s.phase];
    s.ready(a);
    s.ready(idle);
    s.tick(10);
    expect(s.join('late', [], 0, 10)).toBe('started');
    let now = 10;
    let enrageEvents = 0;
    for (let guard = 0; guard < 200 && s.phase !== 3 && s.phase !== 4; guard++) {
      now += 100;
      // `idle` never acts: the auto-action (first move with pp) fights for it at the deadline
      expect(s.action(a, s.round, firstMove(s, a))).toBeNull();
      expect(s.action(a, s.round, firstMove(s, a))).toBe('alreadySubmitted');
      expect(s.action(a, s.round + 1, firstMove(s, a))).toBe('wrongRound');
      now = s.deadlineAt;
      expect(s.roundDue(now)).toBe(true);
      const r = s.prepareRound();
      for (const pid of r.order) {
        const evs = r.events.get(pid) ?? [];
        enrageEvents += evs.filter((e) => e.t === 'abilityTrigger' && e.detail === 'enraged').length;
        const stage = evs.find((e) => e.t === 'statStage' && e.cause === 'ability' && e.source === null);
        if (stage !== undefined && stage.t === 'statStage') expect(stage).toMatchObject({ target: { side: 1, slot: 0 }, stat: 'atk', delta: 2 });
      }
      s.commitRound(r, now);
      if (seen.at(-1) !== s.phase) seen.push(s.phase);
      if (s.phase === 2) expect(s.hpPct).toBeLessThan(RAID_ENRAGE_HP);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(enrageEvents).toBe(2); // once, delivered to both participants' round events
    expect(s.participants.get(a)!.damage).toBeGreaterThan(0);
    // #14: one attempt per participant; the orb must be known
    expect(s.catchAttempt(a, 'not_an_orb')).toBe('unknownOrb');
    // Phase C1: the catch window's battle (battleResync) can catch until the attempt is spent
    expect(s.catchStateFor(a)).toMatchObject({ ended: null, sides: [{ canCatch: true, mustSwitch: false }, { party: [{ creature: { hp: 1 } }] }] });
    expect(s.catchStateFor('00000000-0000-4000-8000-00000000ffff')).toBeNull();
    expect(s.catchAttempt(a, 'spark_orb')).toBe('ok');
    expect(s.catchStateFor(a)!.sides[0].canCatch).toBe(false);
    const roll = s.rollCatch(a, 'spark_orb');
    expect(roll.events.some((e) => e.t === 'catchThrow')).toBe(true);
    expect(roll.stateDigest).toMatch(/^[0-9a-f]{8}$/);
    expect(roll.creature.speciesId).toBe('mossling');
    expect(s.catchAttempt(a, 'spark_orb')).toBe('already');
    expect(s.catchAttempt('00000000-0000-4000-8000-00000000ffff', 'spark_orb')).toBe('notParticipant');
    s.tick(now + RAID_CATCH_WINDOW_MS);
    expect(s.phase).toBe(4);
  });

  it('everyone leaving before the boss falls ends the raid (phase 4, no catch window)', () => {
    const a = '00000000-0000-4000-8000-0000000000b1';
    const s = new RaidSession(WEAK_BOSS, createRng('leave'), content, 0);
    s.join(a, party(a, 'bramblecub', 10), 0, 0);
    s.ready(a);
    s.tick(1);
    s.leave(a, 2);
    expect(s.phase).toBe(4);
    expect(s.catchAttempt(a, 'spark_orb')).toBe('notParticipant');
  });

  it('minBadges gates join; 8 participants at most; an unfit party is refused', () => {
    const s = new RaidSession({ ...WEAK_BOSS, minBadges: 2 }, createRng('g'), content, 0);
    expect(s.join('p', party('000000000001', 'bramblecub', 10), 1, 0)).toBe('badges');
    const t = new RaidSession(WEAK_BOSS, createRng('g'), content, 0);
    for (let i = 0; i < 8; i++) expect(t.join(`p${i}`, party(`00000000000${i}`, 'bramblecub', 10), 0, 0)).toBe('ok');
    expect(t.join('p9', party('000000000009', 'bramblecub', 10), 0, 0)).toBe('full');
    const fainted = party('000000000010', 'bramblecub', 10).map((c) => ({ ...c, hp: 0 }));
    expect(new RaidSession(WEAK_BOSS, createRng('g'), content, 0).join('z', fainted, 0, 0)).toBe('noParty');
  });
});

// ─── in a room ─────────────────────────────────────────────────────────────────

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

async function inRoute(x: number, z: number): Promise<{ acc: Account; j: Joined }> {
  const acc = await register(s);
  const p = nearestWalkable(getHeightfield('mire_route'), x, z, 12)!;
  await placePlayer(s, acc.id, 'mire_route', p[0], p[1]);
  return { acc, j: await enter(s, acc, 'mire_route') };
}

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

describe('raids in the room (§30.4.7)', () => {
  it('join within 8 m, ready, rounds with digests, hpPct only, rewards on defeat, one catch (#14: a replay spends nothing)', async () => {
    const a = await inRoute(0, 0);
    const b = await inRoute(1, 0);
    const room = roomOf(a.j);
    const pa = a.j.room.state.players.get(a.acc.id)!;
    const hotspot: RaidHotspot = { id: 'test_room_raid', zoneId: 'mire_route', x: pa.x, z: pa.z, boss: { species: 'mossling', level: 3, hpMultiplier: 1 }, minBadges: 0, window: { utcHour: 0, minutes: 1440 } };
    const runner = room.openRaid(hotspot, s.time.clock());
    await waitFor(() => a.j.room.state.raid?.id === runner.id && b.j.room.state.raid?.id === runner.id, 3000);
    const view = a.j.room.state.raid!;
    expect(view.hpPct).toBe(1);
    expect(view.phase).toBe(0);
    expect(Object.keys(view.toJSON()).some((k) => /^(hp|maxHp)$/.test(k))).toBe(false);
    // an unknown raid id leaks nothing; joining from far away is refused
    a.j.room.send('raidJoin', { raidId: '00000000-0000-4000-8000-000000000000' });
    await waitFor(() => ofType(a.j.msgs, 'error').some((e) => e.code === 'notFound'), 3000);
    const far = await inRoute(60, 60);
    far.j.room.send('raidJoin', { raidId: runner.id });
    await waitFor(() => ofType(far.j.msgs, 'error').some((e) => e.detail === 'tooFar'), 3000);
    await s.repos.db.transaction(async (tx) => {
      await s.repos.inventory.add(tx, a.acc.id, 'spark_orb', 0);
    });
    for (const p of [a, b]) p.j.room.send('raidJoin', { raidId: runner.id });
    await waitFor(() => runner.session.participants.size === 2, 3000);
    await waitFor(() => a.j.room.state.raid!.damageBoard.size === 2, 3000);
    await sleep(300);
    await sleep(1100); // every raid* message shares the 4 / s window (§30.6.4 `raid`)
    for (const p of [a, b]) p.j.room.send('raidReady', { raidId: runner.id });
    await waitFor(() => a.j.room.state.raid!.phase === 1, 5000);
    // Phase C1: the fight start seeds each client's battle view — battleResync { battleId: raidId } with its private battle
    for (const p of [a, b]) {
      await waitFor(() => ofType(p.j.msgs, 'battleResync').some((m) => m.battleId === runner.id), 3000);
      const r = ofType(p.j.msgs, 'battleResync').find((m) => m.battleId === runner.id)!;
      expect(r.state.format).toBe('raid');
      expect(r.state.turn).toBe(0);
      expect(r.state.sides[0].trainerId).toBe(p.acc.id);
      expect(r.state.sides[0].canCatch).toBe(false);
      expect(r.state.sides[1].party[0]!.creature.speciesId).toBe('mossling');
      expect(r.state.sides[1].party[0]!.creature.hp).toBe(runner.session.bossBattler.maxHp);
      expect(r.stateDigest).toBe(digestBattleState(r.state));
      expect(r.stateDigest).toBe(digestBattleState(runner.session.viewFor(p.acc.id)!));
    }
    expect(ofType(far.j.msgs, 'battleResync')).toHaveLength(0);
    await sleep(1100);
    expect(a.j.room.state.players.get(a.acc.id)!.inBattle).toBe(true);
    // fight: each round both send their first move; raidEvents carry each participant's private digest
    const before = (await api(s, 'GET', '/me', a.acc.access)).body;
    for (let guard = 0; guard < 40 && a.j.room.state.raid!.phase < 3; guard++) {
      const round = runner.session.round;
      for (const p of [a, b]) {
        const part = runner.session.participants.get(p.acc.id);
        if (part === undefined || part.spectator) continue;
        p.j.room.send('raidAction', { raidId: runner.id, round, action: firstMove(runner.session, p.acc.id) });
      }
      await waitFor(() => runner.session.round > round || runner.session.phase >= 3, 5000).catch(() => {
        throw new Error(`round ${round} stalled: a=${JSON.stringify(ofType(a.j.msgs, 'error'))} b=${JSON.stringify(ofType(b.j.msgs, 'error'))} phase=${runner.session.phase}`);
      });
      await sleep(260); // raid messages: 4 / s
    }
    await waitFor(() => a.j.room.state.raid!.phase === 3, 5000);
    expect(a.j.room.state.raid!.hpPct).toBe(0);
    const evs = ofType(a.j.msgs, 'raidEvents');
    expect(evs.length).toBeGreaterThan(0);
    for (const e of evs) expect(e.stateDigest).toMatch(/^[0-9a-f]{8}$/);
    expect(evs.at(-1)!.stateDigest).toBe(digestBattleState(runner.session.participants.get(a.acc.id)!.state));
    // rewards: battleEnd with battleId = raidId to every participant with damage > 0; money + raidClear exp persisted
    const damaged = [a, b].filter((p) => runner.session.participants.get(p.acc.id)!.damage > 0);
    expect(damaged.length).toBeGreaterThan(0);
    for (const p of damaged) {
      await waitFor(() => ofType(p.j.msgs, 'battleEnd').some((m) => m.battleId === runner.id), 3000);
      expect(ofType(p.j.msgs, 'battleEnd').find((m) => m.battleId === runner.id)!.rewards).toMatchObject({ money: RAID_MONEY_PER_LEVEL * 3, trainerExp: TRAINER_EXP.raidClear });
      // Phase D5: the rewarded clear is the `raidClear` event — ach_raid_1 done, ach_raid_10 at 1
      const ach = await rawQuery(s.db, "select quest_id, count, done from quest_progress where player_id = $1 and quest_id in ('ach_raid_1', 'ach_raid_10') order by quest_id", [p.acc.id]);
      expect(ach.map((r) => [r['quest_id'], r['count'], r['done']])).toEqual([['ach_raid_1', 1, true], ['ach_raid_10', 1, false]]);
    }
    expect(a.j.room.state.players.get(a.acc.id)!.inBattle).toBe(false);
    // Phase C1: the catch window opens with a second battleResync to every participant (before the round's battleEnd):
    // the §2.15 pre-state — not ended, boss at 1 HP, canCatch only with damage dealt
    for (const p of [a, b]) {
      await waitFor(() => ofType(p.j.msgs, 'battleResync').filter((m) => m.battleId === runner.id).length === 2, 3000);
      const r = ofType(p.j.msgs, 'battleResync').filter((m) => m.battleId === runner.id)[1]!;
      expect(r.state.ended).toBeNull();
      expect(r.state.sides[0].mustSwitch).toBe(false);
      expect(r.state.sides[1].party[0]!.creature.hp).toBe(1);
      expect(r.state.sides[0].canCatch).toBe(runner.session.participants.get(p.acc.id)!.damage > 0);
      expect(r.stateDigest).toBe(digestBattleState(r.state));
      const end = p.j.msgs.findIndex((m) => m.type === 'battleEnd' && m.battleId === runner.id);
      if (end >= 0) expect(p.j.msgs.indexOf(r)).toBeLessThan(end);
    }
    // the catch window: one attempt per participant; the replay is refused and spends no second orb (#14)
    const catcher = damaged[0]!;
    const orbs0 = (await api(s, 'GET', '/me', catcher.acc.access)).body.inventory.spark_orb as number;
    catcher.j.room.send('raidCatch', { raidId: runner.id, orb: 'spark_orb' });
    await waitFor(() => ofType(catcher.j.msgs, 'raidEvents').some((e) => e.events.some((x) => x.t === 'catchThrow')), 3000);
    await sleep(300);
    catcher.j.room.send('raidCatch', { raidId: runner.id, orb: 'spark_orb' });
    await waitFor(() => ofType(catcher.j.msgs, 'error').some((e) => e.detail === 'already'), 3000);
    await sleep(200);
    const meAfter = (await api(s, 'GET', '/me', catcher.acc.access)).body;
    expect(meAfter.inventory.spark_orb ?? 0).toBe(orbs0 - 1);
    if (catcher === a) expect(meAfter.money).toBe(before.money + RAID_MONEY_PER_LEVEL * 3);
    for (const p of [a, b, far]) await p.j.room.leave(true);
  }, 120_000);

  it('the scheduler opens the hotspot raid in the shard-0 room at the window start (presence election)', async () => {
    const hotspot = RAID_HOTSPOTS.find((h) => h.zoneId === 'mire_route')!;
    const p = await inRoute(0, 0);
    const room = roomOf(p.j);
    room.raid = null;
    room.state.raid = null;
    // jump the server clock to the next window start + 5 s
    const now = s.time.clock();
    const d = new Date(now);
    let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hotspot.window.utcHour, 0, 5);
    if (start <= now) start += 86_400_000;
    s.time.advance(start - now);
    try {
      await waitFor(() => room.raid !== null && p.j.room.state.raid?.id === room.raid.id, 5000);
      expect(room.raid!.session.hotspot.id).toBe(hotspot.id);
      expect(p.j.room.state.raid!.bossSpecies).toBe(hotspot.boss.species);
      const key = `ewa:raid:${hotspot.id}:${new Date(start).toISOString().slice(0, 10)}`;
      expect(await room.presence.get(key)).toBe(room.roomId);
      // leaving the window with nobody fighting closes the raid
      s.time.advance(hotspot.window.minutes * 60_000);
      await waitFor(() => p.j.room.state.raid?.phase === 4, 5000);
    } finally {
      s.time.advance(-(s.time.clock() - now));
      room.raid = null;
      room.state.raid = null;
    }
    await p.j.room.leave(true);
  }, 60_000);
});
