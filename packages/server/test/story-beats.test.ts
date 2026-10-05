/**
 * §50.4.5 story-beats.test.ts — the Act I slice chain, end to end through the room (real server + SDK clients):
 *   mirevale `first_witness` (Prof. Wynn) → mire_route `mire_rival` (Sable, a beat battle) → mirevale `grove_stone`
 *   (the gym door) → the league battle against Grove-Keeper Mira (her content team) → `bloom_after`.
 * Plus the story gate of story-bible §6.1 (the gym waits for `saw_thinning`, IMPLEMENTATION-NOTES S13), the gym
 * badge's authority (only a won league battle writes it; forged / early / repeated interacts write nothing) and the
 * loss path (no badge, no money, the fight stays available after healing).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { beatDoneFlag, getHeightfield, interiorLeaders, league, nearestWalkable } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { TRAINER_EXP, calcMaxHp } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { api, content, enter, ofType, placePlayer, rawQuery, register, sleep, snapshot, startServer, storyOnly, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

async function inZone(acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 3)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  return enter(s, acc, zoneId);
}

/** Setup only: the starter at `level` with full HP (tests never do this through the wire). */
async function boost(acc: Account, level: number): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    const [c] = await s.repos.creatures.party(tx, acc.id);
    const sp = content.species(c!.speciesId);
    await s.repos.creatures.update(tx, { ...c!, level, exp: level ** 3, hp: calcMaxHp(sp.baseHp, level) });
  });
}

async function flagsOf(acc: Account): Promise<string[]> {
  return storyOnly((await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [acc.id])).map((r) => r['flag'])).sort();
}

async function moneyOf(acc: Account): Promise<number> {
  return Number((await rawQuery(s.db, 'select money from players where id = $1', [acc.id]))[0]!['money']);
}

/** The known move with PP left and the highest power (ties: first). */
function strongest(moves: readonly { readonly id: string; readonly pp: number }[]): string {
  let best = moves.find((m) => m.pp > 0)!;
  for (const m of moves) if (m.pp > 0 && content.move(m.id).power > content.move(best.id).power) best = m;
  return best.id;
}

/** Plays the open battle to its end with the first move that has PP (switching in the first standing member). */
async function playOut(j: Joined, battleId: string): Promise<Extract<Joined['msgs'][number], { type: 'battleEnd' }>> {
  const room = roomOf(j);
  for (let guard = 0; guard < 80 && ofType(j.msgs, 'battleEnd').length === 0; guard++) {
    const session = room.battles.get(battleId);
    if (session === null || session === undefined) break;
    const st: BattleState = session.state;
    const side = st.sides[0];
    const a: Action = side.mustSwitch
      ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
      : { kind: 'move', move: strongest(side.party[side.active]!.creature.moves) };
    const n = ofType(j.msgs, 'battleEvents').length;
    j.room.send('battleAction', { battleId, turn: st.turn + 1, action: a });
    await waitFor(() => ofType(j.msgs, 'battleEvents').length > n || ofType(j.msgs, 'battleEnd').length > 0, 5000);
    await sleep(260); // battleAction is limited to 4 / s (§30.6.4)
  }
  await waitFor(() => ofType(j.msgs, 'battleEnd').length > 0, 5000);
  return ofType(j.msgs, 'battleEnd').at(-1)!;
}

/** Sends one interact and waits until the room answered (a message arrived, or 400 ms of silence). */
async function interact(j: Joined, kind: 'npc' | 'gym', targetId: string): Promise<Joined['msgs']> {
  const n = j.msgs.length;
  j.room.send('interact', { kind, targetId });
  await waitFor(() => j.msgs.length > n, 3000).catch(() => undefined);
  await sleep(400);
  return j.msgs.slice(n);
}

/** Phase A: Mira waits in her hall (`mirevale.gym`); stand 2.5 m in front of her, toward the arena. */
const MIRA = interiorLeaders('mirevale').find((l) => l.leagueId === 'verdant_gym')!;
const GYM_AT = { x: MIRA.x + Math.sign(MIRA.arena.x - MIRA.x) * 2.5, z: MIRA.z + Math.sign(MIRA.arena.z - MIRA.z) * 2.5 };

describe('Act I slice chain (§3.5 / §30.4.8, story-bible §5.2 beats 1–4)', () => {
  it('wynn → sable (beat battle) → the gym door (grove_stone) → Mira (league, her content team) → bloom_after; the badge only from the win', async () => {
    const acc = await register(s, 'cindercap');
    await boost(acc, 60);
    let j = await inZone(acc, 'mirevale', 4, -12);

    // 1 · first_witness — the starter beat, no battle
    let out = await interact(j, 'npc', 'mirevale.wynn');
    expect(ofType(out, 'storyBeat').map((b) => `${b.beatId}:${b.phase}`)).toEqual(['first_witness:start', 'first_witness:complete']);
    expect(await flagsOf(acc)).toEqual([beatDoneFlag('first_witness'), 'met_wynn'].sort());

    // the gym before its beat (bible §6.1): refused with a toast, nothing written, no battle
    await j.room.leave(true);
    await sleep(200);
    j = await inZone(acc, 'mirevale', GYM_AT.x, GYM_AT.z);
    let snap = await snapshot(s, acc.id);
    out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'toast').map((t) => t.text)).toEqual(['Mira Thornwell is not taking challengers yet.']);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'leagueLocked' }]);
    expect(ofType(out, 'battleStart')).toEqual([]);
    expect(ofType(out, 'storyBeat')).toEqual([]);
    expect(await snapshot(s, acc.id)).toBe(snap);
    await j.room.leave(true);
    await sleep(200);

    // 2 · mire_rival — facing the story trainer fires the beat (rule 6) and its battle; completes on the win
    j = await inZone(acc, 'mire_route', -60, 8);
    const money0 = await moneyOf(acc);
    out = await interact(j, 'npc', 'sable_mire');
    expect(ofType(out, 'storyBeat').map((b) => `${b.beatId}:${b.phase}`)).toEqual(['mire_rival:start']);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 5000);
    const rival = ofType(j.msgs, 'battleStart')[0]!;
    expect(rival.format).toBe('trainer');
    expect(rival.state.sides[1].party.map((b) => `${b.creature.speciesId}:${b.creature.level}`)).toEqual(['coalette:5', 'glimp:4']);
    const rivalEnd = await playOut(j, rival.battleId);
    expect(rivalEnd.outcome).toEqual({ winner: 0 });
    await waitFor(() => ofType(j.msgs, 'storyBeat').some((b) => b.beatId === 'mire_rival' && b.phase === 'complete'), 5000);
    expect(await flagsOf(acc)).toEqual([beatDoneFlag('first_witness'), beatDoneFlag('mire_rival'), 'met_sable', 'met_wynn', 'trainer:sable_mire:beaten'].sort());
    expect(await moneyOf(acc)).toBe(money0 + 300);
    // the beat is done: the trainer is a plain NPC now (no second reward)
    out = await interact(j, 'npc', 'sable_mire');
    expect(ofType(out, 'battleStart')).toEqual([]);
    expect(ofType(out, 'storyBeat')).toEqual([]);
    await j.room.leave(true);
    await sleep(200);

    // 3 · grove_stone — the gym door runs Mira's beat first (speaker = the league id), no battle
    j = await inZone(acc, 'mirevale', GYM_AT.x, GYM_AT.z);
    expect((await api(s, 'POST', '/heal', acc.access)).status).toBe(200); // Mirevale is a healer town
    out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'storyBeat').map((b) => `${b.beatId}:${b.phase}`)).toEqual(['grove_stone:start', 'grove_stone:complete']);
    expect(ofType(out, 'battleStart')).toEqual([]);
    expect(ofType(out, 'progressionDelta').find((m) => m.flags !== null)!.flags).toEqual(['saw_thinning', beatDoneFlag('grove_stone')]);

    // the league battle: Mira's team verbatim from LEAGUE, format league
    const mira = league('verdant_gym');
    const money1 = await moneyOf(acc);
    out = await interact(j, 'gym', 'verdant_gym');
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 5000);
    const gym = ofType(j.msgs, 'battleStart')[0]!;
    expect(gym.format).toBe('league');
    expect(gym.state.sides[1].trainerId).toBe('verdant_gym');
    expect(gym.state.sides[1].party.map((b) => [b.creature.speciesId, b.creature.level, b.creature.nickname])).toEqual(mira.team.map((m) => [m.species, m.level, m.nickname]));
    expect(await rawQuery(s.db, 'select badge_id from badges where player_id = $1', [acc.id])).toEqual([]); // nothing before the win
    const gymEnd = await playOut(j, gym.battleId);
    expect(gymEnd).toMatchObject({ outcome: { winner: 0 }, rewards: { money: mira.reward, trainerExp: TRAINER_EXP.gymWin, badge: 'bloom' } });
    await waitFor(() => ofType(j.msgs, 'progressionDelta').some((m) => m.badges !== null), 5000);
    expect(ofType(j.msgs, 'progressionDelta').find((m) => m.badges !== null)!.badges).toEqual(['bloom']);
    expect((await rawQuery(s.db, 'select badge_id from badges where player_id = $1', [acc.id])).map((r) => r['badge_id'])).toEqual(['bloom']);
    expect(await moneyOf(acc)).toBe(money1 + mira.reward);
    const me = await api(s, 'GET', '/me', acc.access);
    expect(me.body.badges).toEqual(['bloom']);

    // 4 · bloom_after — the next interact at the door is Mira's badge beat (the room's flags now carry badge:bloom)
    out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'storyBeat').map((b) => `${b.beatId}:${b.phase}`)).toEqual(['bloom_after:start', 'bloom_after:complete']);
    expect(ofType(out, 'battleStart')).toEqual([]);
    // then the gym is done: no rematch in v1, nothing written
    snap = await snapshot(s, acc.id);
    out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'toast').map((t) => t.text)).toEqual(['You already hold this badge.']);
    expect(ofType(out, 'battleStart')).toEqual([]);
    expect(await snapshot(s, acc.id)).toBe(snap);
    expect(await flagsOf(acc)).toContain('bloom_spoken');
    expect(j.room.state.harvestState).toBe('intact'); // harvest is per player, never written by a beat
    await j.room.leave(true);
  }, 240_000);

  it('the badge is never written by a forged interact: out of range, an unknown league id, or a gym of another town', async () => {
    const acc = await register(s, 'cindercap');
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, ['met_wynn', 'met_sable', 'saw_thinning', beatDoneFlag('first_witness'), beatDoneFlag('mire_rival'), beatDoneFlag('grove_stone')], new Date()));
    const j = await inZone(acc, 'mirevale', MIRA.x, MIRA.z + 26); // in the hall, AOI-near but 26 m from Mira
    const snap = await snapshot(s, acc.id);
    let out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'tooFar' });
    out = await interact(j, 'gym', 'blaze_gym');
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notFound' });
    out = await interact(j, 'gym', 'no_such_gym');
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notFound' });
    expect(ofType(j.msgs, 'battleStart')).toEqual([]);
    expect(await snapshot(s, acc.id)).toBe(snap);
    await j.room.leave(true);
  }, 60_000);

  it('losing to Mira: no badge, no money, the beat chain unchanged; after POST /heal the fight is offered again', async () => {
    const acc = await register(s, 'bramblecub'); // L5 grass starter vs L11–14 grass team
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, ['met_wynn', 'met_sable', 'saw_thinning', beatDoneFlag('first_witness'), beatDoneFlag('mire_rival'), beatDoneFlag('grove_stone')], new Date()));
    const j = await inZone(acc, 'mirevale', GYM_AT.x, GYM_AT.z);
    const money0 = await moneyOf(acc);
    const flags0 = await flagsOf(acc);
    await interact(j, 'gym', 'verdant_gym');
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 5000);
    const end = await playOut(j, ofType(j.msgs, 'battleStart')[0]!.battleId);
    expect(end.outcome).toEqual({ winner: 1 });
    expect(end.rewards).toMatchObject({ money: 0, badge: null });
    expect(await rawQuery(s.db, 'select badge_id from badges where player_id = $1', [acc.id])).toEqual([]);
    expect(await moneyOf(acc)).toBe(money0);
    expect(await flagsOf(acc)).toEqual(flags0);
    expect(ofType(j.msgs, 'progressionDelta').some((m) => m.badges !== null)).toBe(false);
    // the whole party fainted: healing in Mirevale (a healer zone), then the door offers the fight again
    const healed = await api(s, 'POST', '/heal', acc.access);
    expect(healed.status).toBe(200);
    await interact(j, 'gym', 'verdant_gym');
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 2, 5000);
    expect(ofType(j.msgs, 'battleStart')[1]!.format).toBe('league');
    await j.room.leave(true);
  }, 180_000);
});
