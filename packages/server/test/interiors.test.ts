/**
 * Phase A interiors on the server (real server + SDK clients, PGlite): every town building opens into a pocket hall
 * reached only through door warps (content `interiorWarps`). Pins:
 *   - door warps both ways (door → hall entry → exit → door), and walls of the hall refuse movement (stamped field);
 *   - per-player gates (`gatesClosedFor`): a closed gate refuses movement, a held flag (on join) or a trainer win
 *     (battle end → `applyFlags`) opens it for that player only;
 *   - a league trainer is challenged where it stands in its hall; the battle forms at the hall's arena and
 *     `battleStart` carries that x / z / yaw;
 *   - puzzle switches: `requires` refuses, `sets` is written once, `warpTo` teleports (also once the flag is held);
 *   - Solenne's league hall: the Wardens in order from inside the hall (Aurelia refused before Veil);
 *   - the spawn director never rolls a spawn inside a pocket footprint;
 *   - a full Mirevale gym walk with real inputs: t1 → gate → both root-stones → t2 → gate → leader gate → Mira → badge;
 *   - a relic shrine (data/shrines.ts): the guardian and the relic refuse until their flags (`requires`), the guardian
 *     fights at the shrine's door approach, and the relic is taken once the guardian is beaten.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import {
  BADGE_ORDER,
  allZones,
  beatDoneFlag,
  encounterTableFor,
  gatesClosedFor,
  getHeightfield,
  interiorAt,
  interiorFootprintAt,
  interiorGates,
  interiorItems,
  interiorLeaders,
  interiorSwitches,
  interiorTrainers,
  interiorWarps,
  interiorsFor,
  isWalkable,
  localToWorld,
  nearestWalkable,
  POSTGAME_FLAG,
  SHRINES,
  shrineGuardianId,
  shrineRelicFlag,
  switchFlag,
} from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { calcMaxHp, createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { validateInput } from '../src/rooms/movement';
import { SpawnDirector, tuningFor } from '../src/rooms/spawnDirector';
import { content, enter, ofType, placePlayer, rawQuery, register, sleep, startServer, storyOnly, waitFor } from './helpers';
import type { Account, Joined, TestServer } from './helpers';

let s: TestServer;

beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

// ─── harness ─────────────────────────────────────────────────────────────────

function roomOf(j: Joined): ZoneRoom {
  return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
}

async function inZone(acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  const p = nearestWalkable(getHeightfield(zoneId), x, z, 3)!;
  await placePlayer(s, acc.id, zoneId, p[0], p[1]);
  return enter(s, acc, zoneId);
}

async function rejoin(j: Joined, acc: Account, zoneId: ZoneId, x: number, z: number): Promise<Joined> {
  await j.room.leave(true);
  await sleep(250);
  return inZone(acc, zoneId, x, z);
}

/** Setup only: the starter at `level` with full HP. */
async function boost(acc: Account, level: number): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    const [c] = await s.repos.creatures.party(tx, acc.id);
    const sp = content.species(c!.speciesId);
    await s.repos.creatures.update(tx, { ...c!, level, exp: level ** 3, hp: calcMaxHp(sp.baseHp, level) });
  });
}

async function grantFlags(acc: Account, flags: readonly string[]): Promise<void> {
  await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, flags, new Date()));
}

async function grantAllBadges(acc: Account): Promise<void> {
  await s.repos.db.transaction(async (tx) => {
    for (const b of BADGE_ORDER) await s.repos.progress.awardBadge(tx, acc.id, b, new Date());
  });
}

async function flagsOf(acc: Account): Promise<string[]> {
  return storyOnly((await rawQuery(s.db, 'select flag from story_flags where player_id = $1', [acc.id])).map((r) => r['flag'])).sort();
}

/** Mira's story beats already played (the gym's story gate `saw_thinning` held, no pre-fight beat left). */
const MIRA_READY = ['met_wynn', 'met_sable', 'saw_thinning', beatDoneFlag('first_witness'), beatDoneFlag('mire_rival'), beatDoneFlag('grove_stone')];

/** The room's per-player closed-gate solids (ZoneUserData.closedGates). */
function closedGatesOf(j: Joined, acc: Account): readonly unknown[] {
  return roomOf(j).clientOf(acc.id)!.userData!.closedGates;
}

function me(j: Joined, acc: Account): { x: number; z: number; seq: number } {
  return j.room.state.players.get(acc.id)!;
}

/**
 * Sends one interact and waits until the room answered: `until` holds, or a message arrived (≤ 1.5 s), then the
 * interact window (4 / s) passes.
 */
async function interact(j: Joined, kind: 'npc' | 'gym' | 'warp' | 'switch' | 'item', targetId: string, until?: () => boolean): Promise<Joined['msgs']> {
  const n = j.msgs.length;
  j.room.send('interact', { kind, targetId });
  await waitFor(() => (until !== undefined ? until() : j.msgs.length > n), until !== undefined ? 3000 : 1500).catch(() => undefined);
  await sleep(300);
  return j.msgs.slice(n);
}

const STEP_M = 0.35; // running cap 8.05 m/s × 50 ms = 0.40 m

/**
 * Walks straight to (tx, tz) with real `input` messages (0.35 m running steps, dt 50 ms, one per acked seq). Stops at
 * the first rejected step (the authoritative pose did not move) and reports it.
 */
async function walkTo(j: Joined, acc: Account, tx: number, tz: number): Promise<{ readonly ok: boolean; readonly x: number; readonly z: number }> {
  for (let guard = 0; guard < 600; guard++) {
    const p = me(j, acc);
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return { ok: true, x: p.x, z: p.z };
    const k = Math.min(1, STEP_M / d);
    const nx = p.x + dx * k;
    const nz = p.z + dz * k;
    const seq = p.seq + 1;
    j.room.send('input', { seq, x: nx, z: nz, angle: Math.atan2(dx, dz), running: true, dtMs: 50 });
    await waitFor(() => me(j, acc).seq >= seq, 3000);
    const q = me(j, acc);
    if (Math.hypot(q.x - nx, q.z - nz) > 0.05) return { ok: false, x: q.x, z: q.z };
    await sleep(15);
  }
  const p = me(j, acc);
  return { ok: false, x: p.x, z: p.z };
}

/** Walks a waypoint path; fails the test with the stuck position when a step is refused. */
async function walkPath(j: Joined, acc: Account, path: readonly (readonly [number, number])[]): Promise<void> {
  for (const [x, z] of path) {
    const r = await walkTo(j, acc, x, z);
    expect(r.ok, `walk to (${x}, ${z}) stuck at (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`).toBe(true);
  }
}

/** The known move with PP left and the highest power. */
function strongest(moves: readonly { readonly id: string; readonly pp: number }[]): string {
  let best = moves.find((m) => m.pp > 0)!;
  for (const m of moves) if (m.pp > 0 && content.move(m.id).power > content.move(best.id).power) best = m;
  return best.id;
}

/** Test-only shortcut: every opposing battler at 1 HP (the session's state is the room's only copy of the truth). */
function weaken(j: Joined, battleId: string): void {
  const session = roomOf(j).battles.get(battleId)!;
  const st = session.state;
  const foe = st.sides[1];
  session.state = { ...st, sides: [st.sides[0], { ...foe, party: foe.party.map((b) => ({ ...b, creature: { ...b.creature, hp: 1 } })) }] } as BattleState;
}

/** Plays the open battle to its end with the strongest move (switching in the first standing member). */
async function playOut(j: Joined, battleId: string): Promise<Extract<Joined['msgs'][number], { type: 'battleEnd' }>> {
  const room = roomOf(j);
  const ended = (): boolean => ofType(j.msgs, 'battleEnd').some((e) => e.battleId === battleId);
  for (let guard = 0; guard < 80 && !ended(); guard++) {
    const session = room.battles.get(battleId);
    if (session === null || session === undefined) break;
    const st: BattleState = session.state;
    const side = st.sides[0];
    const a: Action = side.mustSwitch
      ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
      : { kind: 'move', move: strongest(side.party[side.active]!.creature.moves) };
    const n = ofType(j.msgs, 'battleEvents').length;
    j.room.send('battleAction', { battleId, turn: st.turn + 1, action: a });
    await waitFor(() => ofType(j.msgs, 'battleEvents').length > n || ended(), 5000);
    await sleep(260); // battleAction is limited to 4 / s
  }
  await waitFor(ended, 5000);
  await sleep(150); // the battle-end progression (flags / badges → applyFlags) lands with the end
  return ofType(j.msgs, 'battleEnd').find((e) => e.battleId === battleId)!;
}

/** Interacts with an NPC battle target, waits for its battleStart, optionally weakens, plays it out (must win). */
async function fight(j: Joined, kind: 'npc' | 'gym', targetId: string, opts: { readonly weaken?: boolean } = {}): Promise<Extract<Joined['msgs'][number], { type: 'battleStart' }>> {
  const n = ofType(j.msgs, 'battleStart').length;
  const out = await interact(j, kind, targetId, () => ofType(j.msgs, 'battleStart').length > n);
  const start = ofType(j.msgs, 'battleStart')[n];
  expect(start, `no battleStart for ${targetId}: ${JSON.stringify(out)}`).toBeDefined();
  if (opts.weaken === true) weaken(j, start!.battleId);
  const end = await playOut(j, start!.battleId);
  expect(end.outcome, targetId).toEqual({ winner: 0 });
  return start!;
}

// ─── content handles ─────────────────────────────────────────────────────────

const GYM = interiorsFor('mirevale').find((p) => p.def.id === 'mirevale.gym')!;
const GYM_IN = interiorWarps('mirevale').find((w) => w.id === 'mirevale.gym.in')!;
const GYM_OUT = interiorWarps('mirevale').find((w) => w.id === 'mirevale.gym.out')!;
const MIRA = interiorLeaders('mirevale').find((l) => l.leagueId === 'verdant_gym')!;
const T1 = interiorTrainers('mirevale').find((t) => t.id === 'mirevale.gym.t1')!;
const T2 = interiorTrainers('mirevale').find((t) => t.id === 'mirevale.gym.t2')!;
const STONE_A = interiorSwitches('mirevale').find((x) => x.id === 'mirevale.gym.stone_a')!;
const STONE_B = interiorSwitches('mirevale').find((x) => x.id === 'mirevale.gym.stone_b')!;
const G1 = interiorGates('mirevale').find((g) => g.id === 'mirevale.gym.gate.g1')!;

// ─── pure checks ─────────────────────────────────────────────────────────────

describe('movement validation with per-player gates (pure)', () => {
  it("a closed gate's solid is unwalkable for that player only; the same step is legal once the gate is open", () => {
    const h = getHeightfield('mirevale');
    expect(GYM.at.yaw).toBe(0); // the Mirevale gym hall runs along world z: the gate g1 spans x, the step goes −z
    const from = { x: G1.solid.x, z: G1.solid.z + G1.solid.hd + 0.2 };
    const to = { x: G1.solid.x, z: G1.solid.z + G1.solid.hd - 0.15 };
    expect(isWalkable(h, to.x, to.z)).toBe(true); // gates are never stamped into the field
    const input = { seq: 1, x: to.x, z: to.z, angle: Math.PI, running: true, dtMs: 50 };
    const closed = gatesClosedFor('mirevale', new Set()).map((g) => g.solid);
    expect(closed).toContainEqual(G1.solid);
    expect(validateInput({ x: from.x, z: from.z, lastSeq: 0, budgetMs: 100, inBattle: false, closedGates: closed }, input, h)).toMatchObject({ ok: false, reason: 'unwalkable' });
    const open = gatesClosedFor('mirevale', new Set(G1.opensWhen)).map((g) => g.solid);
    expect(open).not.toContainEqual(G1.solid);
    expect(validateInput({ x: from.x, z: from.z, lastSeq: 0, budgetMs: 100, inBattle: false, closedGates: open }, input, h)).toMatchObject({ ok: true });
    expect(validateInput({ x: from.x, z: from.z, lastSeq: 0, budgetMs: 100, inBattle: false }, input, h)).toMatchObject({ ok: true });
  });
});

describe('the spawn director never places a spawn inside a pocket footprint', () => {
  it('every town with a tuning: thousands of rolls, none inside any pocket (floors are walkable, so the guard matters)', () => {
    const towns = allZones().filter((z) => z.kind === 'town' && tuningFor(z) !== null && interiorsFor(z.id).length > 0);
    expect(towns.length).toBeGreaterThan(0);
    let total = 0;
    for (const z of towns) {
      const h = getHeightfield(z.id);
      // pocket floors are walkable samples: without the guard a land spawn could be rolled there
      const p0 = interiorsFor(z.id)[0]!;
      const [ex, ez] = localToWorld(p0, p0.def.entry.lx, p0.def.entry.lz);
      expect(isWalkable(h, ex, ez), z.id).toBe(true);
      expect(interiorFootprintAt(z.id, ex, ez)?.def.id).toBe(p0.def.id);
      const d = new SpawnDirector(z, encounterTableFor(z.id), createRng(`pocket-${z.id}`), h, tuningFor(z)!, content);
      for (let i = 0; i < 1500; i++) {
        for (const r of d.tick(1_000_000 + i * 20_000, (i % 40) / 40).spawned) {
          expect(interiorFootprintAt(z.id, r.x, r.z), `${z.id} spawn (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`).toBeNull();
          total++;
        }
      }
    }
    expect(total).toBeGreaterThan(300);
  });
});

// ─── through the room ────────────────────────────────────────────────────────

describe('door warps and hall walls', () => {
  it('door → hall entry → exit → door; a wall of the hall refuses a step; the exit warp is out of reach from the door', async () => {
    const acc = await register(s);
    let j = await inZone(acc, 'mirevale', GYM_IN.x, GYM_IN.z);
    expect(interiorAt('mirevale', me(j, acc).x, me(j, acc).z)).toBeNull();

    // the exit warp stands in the hall: from the door it is not reachable
    const out = await interact(j, 'warp', GYM_OUT.id);
    expect(ofType(out, 'error')[0]?.code === 'notFound' || ofType(out, 'error')[0]?.detail === 'tooFar').toBe(true);
    expect(Math.hypot(me(j, acc).x - GYM_IN.x, me(j, acc).z - GYM_IN.z)).toBeLessThan(1);

    // in: the door approach warp lands on the hall's entry
    await interact(j, 'warp', GYM_IN.id, () => Math.hypot(me(j, acc).x - GYM_IN.toX, me(j, acc).z - GYM_IN.toZ) < 0.6);
    expect(Math.hypot(me(j, acc).x - GYM_IN.toX, me(j, acc).z - GYM_IN.toZ)).toBeLessThan(0.6);
    expect(interiorAt('mirevale', me(j, acc).x, me(j, acc).z)?.def.id).toBe('mirevale.gym');

    // a wall: walking west across the floor stops at the hall's west wall (floor edge = centre − w/2)
    const westEdge = GYM.at.x - GYM.def.w / 2;
    const wall = await walkTo(j, acc, westEdge - 3, me(j, acc).z);
    expect(wall.ok).toBe(false);
    expect(wall.x).toBeGreaterThan(westEdge - 0.01);
    expect(roomOf(j).metrics.rejectedInputs.unwalkable).toBeGreaterThan(0);
    expect(interiorAt('mirevale', wall.x, wall.z)?.def.id).toBe('mirevale.gym');

    // out: back to the entry, then the exit warp lands on the door approach
    await walkPath(j, acc, [[GYM_IN.toX, GYM_IN.toZ]]);
    await interact(j, 'warp', GYM_OUT.id, () => Math.hypot(me(j, acc).x - GYM_OUT.toX, me(j, acc).z - GYM_OUT.toZ) < 0.6);
    expect(Math.hypot(me(j, acc).x - GYM_OUT.toX, me(j, acc).z - GYM_OUT.toZ)).toBeLessThan(0.6);
    expect(interiorAt('mirevale', me(j, acc).x, me(j, acc).z)).toBeNull();
    j = await rejoin(j, acc, 'mirevale', 0, 6);
    await j.room.leave(true);
  }, 120_000);
});

describe('per-player gates', () => {
  it('a closed gate refuses movement; a trainer win opens it (battle end → applyFlags); a stored flag opens it on join', async () => {
    const acc = await register(s, 'cindercap');
    await boost(acc, 60);
    let j = await inZone(acc, 'mirevale', G1.solid.x, G1.solid.z + 2);
    // closed: the step into g1's solid is refused
    const stuck = await walkTo(j, acc, G1.solid.x, G1.solid.z - 2);
    expect(stuck.ok).toBe(false);
    expect(stuck.z).toBeGreaterThan(G1.solid.z + G1.solid.hd - 0.01);
    expect(closedGatesOf(j, acc)).toContainEqual(G1.solid);

    // the trainer behind it: battle → win → trainer:<id>:beaten → the gate list is recomputed
    await walkPath(j, acc, [[T1.x - 1, T1.z + 0.9]]);
    const start = await fight(j, 'npc', T1.id);
    expect(start.format).toBe('trainer');
    expect(await flagsOf(acc)).toContain('trainer:mirevale.gym.t1:beaten');
    expect(closedGatesOf(j, acc)).not.toContainEqual(G1.solid);
    await walkPath(j, acc, [[G1.solid.x, G1.solid.z + 2], [G1.solid.x, G1.solid.z - 2]]);

    // a second player without the flag is still refused at the same gate
    const other = await register(s);
    const jo = await inZone(other, 'mirevale', G1.solid.x, G1.solid.z + 2);
    expect((await walkTo(jo, other, G1.solid.x, G1.solid.z - 2)).ok).toBe(false);
    await jo.room.leave(true);

    // join path: the stored flag opens the gate from the first input
    j = await rejoin(j, acc, 'mirevale', G1.solid.x, G1.solid.z + 2);
    expect(closedGatesOf(j, acc)).not.toContainEqual(G1.solid);
    await walkPath(j, acc, [[G1.solid.x, G1.solid.z - 2]]);
    await j.room.leave(true);
  }, 180_000);
});

describe('league trainers are challenged in their halls; the battle forms at the hall arena', () => {
  it("Mira from inside her hall: startNpc at the room arena, battleStart carries x / z / yaw; the old door marker is not the challenge point", async () => {
    const acc = await register(s, 'cindercap');
    await boost(acc, 60);
    await grantFlags(acc, MIRA_READY);
    // the old marker by the door (0, −23.5): Mira is not there any more
    let j = await inZone(acc, 'mirevale', 0, -23.5);
    let out = await interact(j, 'gym', 'verdant_gym');
    expect(ofType(out, 'error').length).toBe(1);
    expect(ofType(out, 'battleStart')).toEqual([]);

    j = await rejoin(j, acc, 'mirevale', MIRA.x, MIRA.z + 2.5);
    out = await interact(j, 'gym', 'verdant_gym', () => ofType(j.msgs, 'battleStart').length > 0);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.format).toBe('league');
    expect(start.x).toBeCloseTo(MIRA.arena.x, 6);
    expect(start.z).toBeCloseTo(MIRA.arena.z, 6);
    expect(start.yaw).toBeCloseTo(MIRA.yaw, 6);
    const session = roomOf(j).battles.get(start.battleId)!;
    expect([session.x, session.z, session.yaw]).toEqual([MIRA.arena.x, MIRA.arena.z, MIRA.yaw]);
    // the player was not moved; the battle summary in the room state carries the arena too
    expect(Math.hypot(me(j, acc).x - MIRA.x, me(j, acc).z - (MIRA.z + 2.5))).toBeLessThan(1);
    await j.room.leave(true); // forfeit
  }, 120_000);

  it('a battle in the open (outside any hall) keeps the player position and yaw null', async () => {
    const acc = await register(s, 'cindercap');
    await boost(acc, 60);
    await grantFlags(acc, ['met_wynn', beatDoneFlag('first_witness')]);
    const j = await inZone(acc, 'mire_route', -60, 8);
    // story trainer Sable fires its beat battle at the player's position in the open
    await interact(j, 'npc', 'sable_mire', () => ofType(j.msgs, 'battleStart').length > 0);
    const start = ofType(j.msgs, 'battleStart')[0]!;
    expect(start.x).toBeCloseTo(me(j, acc).x, 3);
    expect(start.z).toBeCloseTo(me(j, acc).z, 3);
    expect(start.yaw).toBeNull();
    await j.room.leave(true);
  }, 60_000);
});

describe('puzzle switches', () => {
  it('requires refuses (toast + switchLocked, nothing written); sets is written once (progressionDelta)', async () => {
    const acc = await register(s);
    let j = await inZone(acc, 'mirevale', STONE_A.x - 2, STONE_A.z);
    let out = await interact(j, 'switch', STONE_A.id);
    expect(ofType(out, 'toast').length).toBe(1);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'switchLocked' }]);
    expect(await flagsOf(acc)).not.toContain(STONE_A.sets);

    // out of range: tooFar
    out = await interact(j, 'switch', STONE_B.id);
    expect(ofType(out, 'error')[0]).toMatchObject({ code: 'notAllowed', detail: 'tooFar' });

    await grantFlags(acc, STONE_A.requires);
    j = await rejoin(j, acc, 'mirevale', STONE_A.x - 2, STONE_A.z);
    out = await interact(j, 'switch', STONE_A.id);
    expect(STONE_A.sets).toBe(switchFlag('mirevale', STONE_A.id));
    expect(ofType(out, 'progressionDelta').map((m) => m.flags)).toEqual([[STONE_A.sets]]);
    expect(ofType(out, 'error')).toEqual([]);
    expect(await flagsOf(acc)).toContain(STONE_A.sets);
    // a second press writes nothing
    out = await interact(j, 'switch', STONE_A.id);
    expect(ofType(out, 'progressionDelta')).toEqual([]);
    expect(ofType(out, 'error')).toEqual([]);
    await j.room.leave(true);
  }, 90_000);

  it('warpTo teleports: a free decoy tile, a gated tile (refused, then flag + teleport), and again once the flag is held', async () => {
    const tiles = interiorSwitches('vesperveil');
    const decoy = tiles.find((x) => x.id === 'vesperveil.gym.decoy_1')!;
    const tile = tiles.find((x) => x.id === 'vesperveil.gym.tile_1')!;
    expect(decoy.warpTo).not.toBeNull();
    expect(decoy.requires).toEqual([]);
    expect(tile.warpTo).not.toBeNull();
    expect(tile.sets).not.toBeNull();
    const near = (to: { x: number; z: number }) => (j: Joined, acc: Account) => Math.hypot(me(j, acc).x - to.x, me(j, acc).z - to.z) < 0.8;
    const acc = await register(s);
    await grantAllBadges(acc);

    let j = await inZone(acc, 'vesperveil', decoy.x, decoy.z);
    let out = await interact(j, 'switch', decoy.id, () => near(decoy.warpTo!)(j, acc));
    expect(near(decoy.warpTo!)(j, acc)).toBe(true);
    expect(ofType(out, 'progressionDelta')).toEqual([]);

    j = await rejoin(j, acc, 'vesperveil', tile.x, tile.z);
    const at0 = { x: me(j, acc).x, z: me(j, acc).z };
    out = await interact(j, 'switch', tile.id);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'switchLocked' }]);
    expect(Math.hypot(me(j, acc).x - at0.x, me(j, acc).z - at0.z)).toBeLessThan(0.01);

    await grantFlags(acc, tile.requires);
    j = await rejoin(j, acc, 'vesperveil', tile.x, tile.z);
    out = await interact(j, 'switch', tile.id, () => near(tile.warpTo!)(j, acc));
    expect(near(tile.warpTo!)(j, acc)).toBe(true);
    expect(ofType(out, 'progressionDelta').map((m) => m.flags)).toEqual([[tile.sets]]);
    expect(await flagsOf(acc)).toContain(tile.sets);

    // flag held: the tile still teleports, writes nothing
    j = await rejoin(j, acc, 'vesperveil', tile.x, tile.z);
    out = await interact(j, 'switch', tile.id, () => near(tile.warpTo!)(j, acc));
    expect(near(tile.warpTo!)(j, acc)).toBe(true);
    expect(ofType(out, 'progressionDelta')).toEqual([]);
    await j.room.leave(true);
  }, 120_000);
});

describe("Solenne's league hall", () => {
  it('Wardens in order from inside the hall: Aurelia refused before Veil; Veil at chamber 1, the win opens the gate, Aurelia at chamber 2', async () => {
    const leaders = interiorLeaders('solenne');
    const veil = leaders.find((l) => l.leagueId === 'veil')!;
    const aurelia = leaders.find((l) => l.leagueId === 'aurelia')!;
    expect(veil.interior).toBe('solenne.league');
    const c1 = interiorGates('solenne').find((g) => g.opensWhen.includes('elite:veil:beaten'))!;
    // the axis of the hall runs along world z (yaw π here): "in front of" a leader is toward its arena
    const front = (l: typeof veil, m: number) => ({ x: l.x + Math.sign(l.arena.x - l.x) * m, z: l.z + Math.sign(l.arena.z - l.z) * m });
    const acc = await register(s, 'cindercap');
    await boost(acc, 100);
    await grantAllBadges(acc);
    // the Wardens' story gate (LEAGUE_STORY_GATES: `wardens_met`, set by the `wardens_charge` beat)
    await s.repos.db.transaction((tx) => s.repos.progress.setFlags(tx, acc.id, ['wardens_met', beatDoneFlag('wardens_charge')], new Date()));

    // Aurelia first (placed behind the closed gate — setup only): refused by the league order
    const fa = front(aurelia, 2);
    let j = await inZone(acc, 'solenne', fa.x, fa.z);
    let out = await interact(j, 'gym', 'aurelia');
    expect(ofType(out, 'toast').map((t) => t.text)).toEqual(['Face the previous Warden first.']);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'leagueLocked' }]);
    expect(ofType(out, 'battleStart')).toEqual([]);

    // Veil's chamber: the gate toward Aurelia is shut
    const fv = front(veil, 2);
    j = await rejoin(j, acc, 'solenne', fv.x, fv.z);
    const toward = await walkTo(j, acc, c1.solid.x, c1.solid.z + Math.sign(aurelia.z - veil.z) * 2);
    expect(toward.ok).toBe(false);
    expect(Math.hypot(toward.x - veil.x, toward.z - veil.z)).toBeLessThan(4);
    const start = await fight(j, 'gym', 'veil', { weaken: true });
    expect(start.format).toBe('league');
    expect(start.state.sides[1].trainerId).toBe('veil');
    expect([start.x, start.z]).toEqual([veil.arena.x, veil.arena.z]);
    expect(start.yaw).toBeCloseTo(veil.yaw, 9);
    expect(await flagsOf(acc)).toContain('elite:veil:beaten');

    // the win opened the gate for this player: walk on to Aurelia, she now accepts
    await walkPath(j, acc, [[fa.x, fa.z]]);
    out = await interact(j, 'gym', 'aurelia', () => ofType(j.msgs, 'battleStart').length > 1);
    const second = ofType(j.msgs, 'battleStart')[1]!;
    expect(second.state.sides[1].trainerId).toBe('aurelia');
    expect([second.x, second.z]).toEqual([aurelia.arena.x, aurelia.arena.z]);
    await j.room.leave(true);
  }, 240_000);
});

describe('a full Mirevale gym walk with real inputs', () => {
  it('entry → t1 → gate g1 → both root-stones → t2 → gate g2 → leader gate → Mira → the badge', async () => {
    const acc = await register(s, 'cindercap');
    await boost(acc, 60);
    await grantFlags(acc, MIRA_READY);
    const j0 = await inZone(acc, 'mirevale', GYM_IN.x, GYM_IN.z);
    await interact(j0, 'warp', GYM_IN.id, () => Math.hypot(me(j0, acc).x - GYM_IN.toX, me(j0, acc).z - GYM_IN.toZ) < 0.6);
    const j = j0;
    const cx = GYM.at.x; // the hall's centre line (yaw 0: local x = world x − cx, local z = world z − at.z)
    const wz = (lz: number) => GYM.at.z + lz;
    const leaderGate = interiorGates('mirevale').find((g) => g.id === 'mirevale.gym.gate.leader')!;
    const g2 = interiorGates('mirevale').find((g) => g.id === 'mirevale.gym.gate.g2')!;

    // t1, then g1 (which refused before the win)
    await walkPath(j, acc, [[cx, wz(12)]]);
    expect((await walkTo(j, acc, cx, wz(8.2))).ok).toBe(false);
    await walkPath(j, acc, [[cx, wz(12)], [T1.x - 1.3, T1.z + 0.9]]);
    await fight(j, 'npc', T1.id);
    // corridor 1 (between the hedges at local z 10 and 6.5): root-stone A to the east
    await walkPath(j, acc, [[cx, wz(12)], [cx, wz(8.2)], [STONE_A.x - 2, STONE_A.z]]);
    let out = await interact(j, 'switch', STONE_A.id);
    expect(ofType(out, 'progressionDelta').map((m) => m.flags)).toEqual([[STONE_A.sets]]);
    // west through the gap in the local-z-6.5 hedge: root-stone B
    await walkPath(j, acc, [[cx - 8, wz(8.2)], [cx - 8, wz(4.75)], [STONE_B.x + 1, STONE_B.z]]);
    out = await interact(j, 'switch', STONE_B.id);
    expect(ofType(out, 'progressionDelta').map((m) => m.flags)).toEqual([[STONE_B.sets]]);
    // corridor 2: t2, then g2 (now open) down to corridor 3
    await walkPath(j, acc, [[cx - 8, wz(4.75)], [T2.x - 2.4, wz(4.75)]]);
    await fight(j, 'npc', T2.id);
    expect(closedGatesOf(j, acc)).toEqual([]);
    await walkPath(j, acc, [[g2.solid.x, wz(4.75)], [g2.solid.x, wz(0.5)], [cx, wz(0.5)], [leaderGate.solid.x, MIRA.z + 2.5]]);
    // Mira: the league battle forms at the arena, the badge from the win
    const start = await fight(j, 'gym', 'verdant_gym');
    expect([start.x, start.z, start.yaw]).toEqual([MIRA.arena.x, MIRA.arena.z, MIRA.yaw]);
    await waitFor(() => ofType(j.msgs, 'progressionDelta').some((m) => m.badges !== null), 5000);
    expect((await rawQuery(s.db, 'select badge_id from badges where player_id = $1', [acc.id])).map((r) => r['badge_id'])).toEqual(['bloom']);
    const flags = await flagsOf(acc);
    for (const f of ['trainer:mirevale.gym.t1:beaten', 'trainer:mirevale.gym.t2:beaten', STONE_A.sets!, STONE_B.sets!]) expect(flags).toContain(f);
    // and out through the exit
    await walkPath(j, acc, [[cx, wz(0.5)], [g2.solid.x, wz(0.5)], [g2.solid.x, wz(4.75)], [cx - 8, wz(4.75)], [cx - 8, wz(8.2)], [cx, wz(8.2)], [cx, wz(12)], [GYM_IN.toX, GYM_IN.toZ]]);
    await interact(j, 'warp', GYM_OUT.id, () => Math.hypot(me(j, acc).x - GYM_OUT.toX, me(j, acc).z - GYM_OUT.toZ) < 0.6);
    expect(interiorAt('mirevale', me(j, acc).x, me(j, acc).z)).toBeNull();
    await j.room.leave(true);
  }, 300_000);
});

describe('relic shrines', () => {
  const shrine = SHRINES.find((x) => x.zoneId === 'saltmourn')!;
  const P = interiorsFor('saltmourn').find((p) => p.def.id === shrine.building)!;
  const guardian = interiorTrainers('saltmourn').find((t) => t.id === shrineGuardianId(shrine))!;
  const relic = interiorItems('saltmourn').find((i) => i.item === shrine.relic)!;
  const at = (lx: number, lz: number): [number, number] => localToWorld(P, lx, lz);

  it('the guardian and the relic refuse until their flags; the guardian fights at the door; the relic is taken after it', async () => {
    const acc = await register(s);
    await boost(acc, 90);
    await grantAllBadges(acc);
    // before the Champion: the guardian waits (toast + trainerLocked, no battle)
    let [x, z] = at(0, 1.7);
    let j = await inZone(acc, 'saltmourn', x, z);
    let out = await interact(j, 'npc', guardian.id);
    expect(ofType(out, 'toast').length).toBe(1);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'trainerLocked' }]);
    expect(ofType(out, 'battleStart')).toEqual([]);

    // after the Champion, between the gates: the relic is still held by the rune (itemLocked, nothing written)
    await grantFlags(acc, [POSTGAME_FLAG]);
    [x, z] = at(0, -1.3);
    j = await rejoin(j, acc, 'saltmourn', x, z);
    out = await interact(j, 'item', relic.id);
    expect(ofType(out, 'error')).toEqual([{ type: 'error', code: 'notAllowed', detail: 'itemLocked' }]);
    expect(await flagsOf(acc)).not.toContain(shrineRelicFlag(shrine));

    // the guardian fights, and the battle forms at the shrine's door approach (the hall is too small for an arena)
    const n = ofType(j.msgs, 'battleStart').length;
    await interact(j, 'npc', guardian.id, () => ofType(j.msgs, 'battleStart').length > n);
    const start = ofType(j.msgs, 'battleStart')[n]!;
    expect(start).toBeDefined();
    expect(start.x).toBeCloseTo(P.door.x, 6);
    expect(start.z).toBeCloseTo(P.door.z, 6);
    await j.room.leave(true); // forfeit

    // once the guardian is beaten the relic comes away (flag + inventory)
    await grantFlags(acc, [`trainer:${guardian.id}:beaten`]);
    j = await inZone(acc, 'saltmourn', x, z);
    out = await interact(j, 'item', relic.id);
    expect(ofType(out, 'error')).toEqual([]);
    expect(ofType(out, 'inventoryDelta').map((m) => m.items)).toEqual([{ [shrine.relic]: 1 }]);
    expect(await flagsOf(acc)).toContain(shrineRelicFlag(shrine));
    await j.room.leave(true);
  }, 180_000);
});
