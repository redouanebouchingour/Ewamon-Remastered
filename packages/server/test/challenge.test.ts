/**
 * Challenge modes (content challenge.ts): a run chosen at registration; POST /challenge switches it while there is no
 * badge (and refuses after one); in a run only the zone's first wild encounter may be caught; Hardcore's battle bag
 * is the orbs alone; a creature that faints in a run falls (ribbon), is refused by withdraw / evolve / items and is not
 * healed; when nothing is left that has not fallen the run fails and the fallen keep a memorial ribbon; the Nuzlocke
 * board lists the run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHALLENGE_CLEARED_FLAG, CHALLENGE_FAILED_FLAG, CHALLENGE_MODE_FLAG, FALLEN_MEMORIAL_RIBBON, FALLEN_RIBBON, LEAGUE, challengeMetFlag, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action, BattleState } from '@ewa/core';
import type { AnyDb, Db, Repos } from '@ewa/persist';
import type { ServerMessage } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator, CHAMPION_FLAG, CHAMPION_ID } from '../src/rooms/battleSession';
import type { BattleHost, BattleSession } from '../src/rooms/battleSession';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, rawQuery, register, startServer, uniqueName } from './helpers';
import type { TestServer } from './helpers';

let db: AnyDb;
let repos: Repos & { readonly db: Db };
let s: TestServer;
const now = 1_800_000_000_000;

beforeAll(async () => {
  s = await startServer();
  // the coordinator under test and the REST routes share the test server's database
  db = s.db;
  repos = s.repos;
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

function host(): BattleHost & { readonly msgs: ServerMessage[] } {
  const msgs: ServerMessage[] = [];
  return { msgs, send: (_p, m) => void msgs.push(m), onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
}

function coordinator(h: BattleHost): BattleCoordinator {
  return new BattleCoordinator(createRng('challenge'), { repos, content, clock: () => now, log: silentLogger(), zone: zone('mire_route'), host: h, metrics: createRoomMetrics('r', 'mire_route', 0) });
}

async function mkPlayer(party: { species: string; level: number }[], flags: string[], items: Record<string, number> = { spark_orb: 5, potion: 5 }): Promise<string> {
  return repos.db.transaction(async (tx) => {
    const name = uniqueName('c');
    const { id } = await repos.players.create(tx, { username: name, email: `${name}@c.test`, passwordHash: 'x' }, new Date(now));
    for (let i = 0; i < party.length; i++) await repos.creatures.insert(tx, newCreature(content, party[i]!.species, party[i]!.level, { ownerId: id }), { kind: 'party', index: i });
    await repos.inventory.addMany(tx, id, items);
    if (flags.length > 0) await repos.progress.setFlags(tx, id, flags, new Date(now));
    return id;
  });
}

function spawn(speciesId: string, level: number): SpawnRecord {
  return { id: `t:${Math.floor(Math.random() * 1e9)}`, speciesId, level, variantKey: 'normal', isAlpha: false, ability: content.species(speciesId).abilities[0]!, medium: 'land', x: 0, z: 0, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
}

async function settle(c: BattleCoordinator, id: string): Promise<void> {
  for (let i = 0; i < 400 && c.get(id)?.resolving; i++) await new Promise((r) => setTimeout(r, 5));
}

/** Plays until the end with the side-0 player's strongest move (switching in the next standing creature when it must). */
async function playOut(c: BattleCoordinator, pid: string, session: BattleSession): Promise<void> {
  for (let guard = 0; guard < 200 && c.get(session.id) !== null; guard++) {
    const st: BattleState = c.get(session.id)!.state;
    const side = st.sides[0];
    if (!side.mustSwitch && st.sides[1].mustSwitch) {
      await settle(c, session.id);
      continue;
    }
    const a: Action = side.mustSwitch
      ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
      : { kind: 'move', move: [...side.party[side.active]!.creature.moves.filter((m) => m.pp > 0)].sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!.id };
    c.action(pid, session.id, st.turn + 1, a);
    await settle(c, session.id);
  }
}

async function flagsOf(pid: string): Promise<string[]> {
  return repos.db.transaction((tx) => repos.progress.flags(tx, pid));
}

describe('challenge modes: the run', () => {
  it('chosen at registration; switched before the first badge; refused after one', async () => {
    const acc = await register(s, 'bramblecub');
    const reg = await s.booted.rest.inject({ method: 'POST', url: '/auth/register', payload: { username: uniqueName('nz'), email: `${uniqueName('nz')}@t.ewa`, password: 'correct horse battery', starter: 'glimfin', challenge: 'nuzlocke' }, remoteAddress: '10.9.9.9' });
    expect(reg.statusCode).toBe(200);
    const nz = reg.json() as { access: string; player: { id: string } };
    expect(await flagsOf(nz.player.id)).toContain(CHALLENGE_MODE_FLAG.nuzlocke);
    const sw = await api(s, 'POST', '/challenge', acc.access, { mode: 'hardcore' });
    expect(sw.status).toBe(200);
    expect(sw.body.flags).toContain(CHALLENGE_MODE_FLAG.hardcore);
    const off = await api(s, 'POST', '/challenge', acc.access, { mode: 'normal' });
    expect(off.body.flags.some((f: string) => f.startsWith('challenge:'))).toBe(false);
    await rawQuery(s.db, "insert into badges (player_id, badge_id) values ($1, 'bloom')", [acc.id]);
    expect(await api(s, 'POST', '/challenge', acc.access, { mode: 'nuzlocke' })).toMatchObject({ status: 409, body: { code: 'badges' } });
  }, 60_000);
});

describe('challenge modes: battles', () => {
  it('only the zone’s first wild encounter may be caught (the flag is set when it starts)', async () => {
    const h = host();
    const c = coordinator(h);
    const pid = await mkPlayer([{ species: 'cindercap', level: 60 }], [CHALLENGE_MODE_FLAG.nuzlocke]);
    const first = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('glimp', 3), { x: 0, z: 0 });
    if (!first.ok) throw new Error(first.detail);
    expect(first.session.state.sides[0].canCatch).toBe(true);
    expect(await flagsOf(pid)).toContain(challengeMetFlag('mire_route'));
    expect(h.msgs.some((m) => m.type === 'progressionDelta' && m.flags?.includes(challengeMetFlag('mire_route')))).toBe(true);
    await playOut(c, pid, first.session);
    const second = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('glimp', 3), { x: 0, z: 0 });
    if (!second.ok) throw new Error(second.detail);
    expect(second.session.state.sides[0].canCatch).toBe(false);
    await playOut(c, pid, second.session);
    // a normal game catches every time and sets no flag
    const normal = await mkPlayer([{ species: 'cindercap', level: 60 }], []);
    const n = await c.startWild({ playerId: normal, sessionId: 's' }, spawn('glimp', 3), { x: 0, z: 0 });
    if (!n.ok) throw new Error(n.detail);
    expect(n.session.state.sides[0].canCatch).toBe(true);
    expect((await flagsOf(normal)).some((f) => f.startsWith('challenge:'))).toBe(false);
    await playOut(c, normal, n.session);
  }, 60_000);

  it('Hardcore fights with the orbs alone: a potion is refused as noItem', async () => {
    const c = coordinator(host());
    const pid = await mkPlayer([{ species: 'cindercap', level: 60 }], [CHALLENGE_MODE_FLAG.hardcore]);
    const r = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('glimp', 3), { x: 0, z: 0 });
    if (!r.ok) throw new Error(r.detail);
    expect(r.session.inventory[0]).toEqual({ spark_orb: 5 });
    expect(c.action(pid, r.session.id, 1, { kind: 'item', item: 'potion', target: 0 })).toMatchObject({ detail: 'noItem' });
    await playOut(c, pid, r.session);
  }, 60_000);

  it('a creature that faints falls; with nothing left the run fails and the fallen keep a memorial ribbon', async () => {
    const c = coordinator(host());
    const pid = await mkPlayer([{ species: 'bramblecub', level: 2 }], [CHALLENGE_MODE_FLAG.nuzlocke]);
    const r = await c.startWild({ playerId: pid, sessionId: 's' }, spawn('cindercap', 40), { x: 0, z: 0 });
    if (!r.ok) throw new Error(r.detail);
    await playOut(c, pid, r.session);
    const [row] = await rawQuery(db, 'select ribbons, hp from creature_instances where owner_id = $1', [pid]);
    expect(row!['hp']).toBe(0);
    expect(row!['ribbons']).toEqual([FALLEN_MEMORIAL_RIBBON]);
    expect(await flagsOf(pid)).toContain(CHALLENGE_FAILED_FLAG);
  }, 60_000);

  it('beating the Champion during a run clears it', async () => {
    const c = coordinator(host());
    const six = Array.from({ length: 6 }, () => ({ species: 'hyoryu', level: 100 }));
    const pid = await mkPlayer(six, [CHALLENGE_MODE_FLAG.hardcore]);
    const champ = LEAGUE.find((l) => l.id === CHAMPION_ID)!;
    const r = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: champ }, null, { x: 0, z: 0 });
    if (!r.ok) throw new Error(r.detail);
    await playOut(c, pid, r.session);
    const flags = await flagsOf(pid);
    expect(flags).toContain(CHAMPION_FLAG);
    expect(flags).toContain(CHALLENGE_CLEARED_FLAG);
  }, 120_000);

  it('the fallen are refused by withdraw and items and are not healed', async () => {
    const acc = await register(s, 'bramblecub');
    const fallenId = await repos.db.transaction(async (tx) => {
      await repos.progress.setFlags(tx, acc.id, [CHALLENGE_MODE_FLAG.nuzlocke], new Date(now));
      const c = await repos.creatures.insert(tx, { ...newCreature(content, 'glimfin', 10, { ownerId: acc.id }), hp: 0, ribbons: [FALLEN_RIBBON] }, { kind: 'party', index: 1 });
      await repos.inventory.addMany(tx, acc.id, { revive: 1 });
      return c.id;
    });
    expect(await api(s, 'POST', '/item/use', acc.access, { item: 'revive', qty: 1, target: fallenId })).toMatchObject({ status: 409, body: { code: 'fallen' } });
    expect((await api(s, 'POST', '/party/deposit', acc.access, { id: fallenId })).status).toBe(200);
    expect(await api(s, 'POST', '/party/withdraw', acc.access, { id: fallenId })).toMatchObject({ status: 409, body: { code: 'fallen' } });
    expect(await api(s, 'POST', '/challenge', acc.access, { mode: 'normal' })).toMatchObject({ status: 409, body: { code: 'fallen' } });
    const board = await api(s, 'GET', '/leaderboard?mode=nuzlocke', acc.access);
    expect(board.body.rows.find((r: { id: string }) => r.id === acc.id)).toMatchObject({ challengeState: 'active', challengeBadges: 0 });
  }, 60_000);
});
