/**
 * Verified speedruns: the play clock runs while a zone room holds the player and stops when they leave (GET /speedrun);
 * a story beat and a badge write their splits in their own transactions; a run holding the first beat's split counts
 * and its Champion split ranks on the speedrun board; another trainer's run is readable by name.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEAGUE, STORY, zone } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Action } from '@ewa/core';
import { SpeedrunRes } from '@ewa/protocol';
import { newCreature } from '../src/game/creatures';
import { CHAMPION_SPLIT, RUN_START_SPLIT, badgeSplit, beatSplit } from '../src/game/speedrun';
import { silentLogger } from '../src/log';
import { createRoomMetrics } from '../src/metrics';
import { BattleCoordinator } from '../src/rooms/battleSession';
import type { BattleSession } from '../src/rooms/battleSession';
import { completeBeatInTx } from '../src/rooms/storyBeats';
import { api, content, enter, register, sleep, startServer, uniqueName } from './helpers';
import type { TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => {
  s = await startServer();
}, 120_000);
afterAll(async () => {
  await s?.stop();
}, 60_000);

describe('verified speedruns', () => {
  it('the clock runs while a room holds the player and stops when they leave', async () => {
    const acc = await register(s);
    const before = await api(s, 'GET', '/speedrun', acc.access);
    expect(SpeedrunRes.safeParse(before.body).success).toBe(true);
    expect(before.body).toMatchObject({ username: acc.username, playMs: 0, running: false, counted: false, finishMs: null, splits: [] });
    const j = await enter(s, acc, 'mirevale');
    await sleep(300);
    const live = (await api(s, 'GET', '/speedrun', acc.access)).body;
    expect(live.running).toBe(true);
    expect(live.playMs).toBeGreaterThan(0);
    await j.room.leave(true);
    await sleep(300);
    const after = (await api(s, 'GET', '/speedrun', acc.access)).body;
    expect(after.running).toBe(false);
    expect(after.playMs).toBeGreaterThanOrEqual(live.playMs);
    await sleep(200);
    expect((await api(s, 'GET', '/speedrun', acc.access)).body.playMs).toBe(after.playMs);
  }, 60_000);

  it('a beat and a badge write their splits; a counted run reaches the board at the Champion split', async () => {
    const acc = await register(s);
    const now = new Date();
    await s.repos.db.transaction(async (tx) => {
      await s.repos.runs.start(tx, acc.id, new Date(now.getTime() - 60_000));
      await completeBeatInTx(tx, s.repos, acc.id, STORY[0]!, now);
    });
    // a gym win through the battle transaction: the badge split
    const pid = acc.id;
    await s.repos.db.transaction(async (tx) => {
      await s.repos.creatures.insert(tx, newCreature(content, 'cindercap', 70, { ownerId: pid }), { kind: 'party', index: 1 });
    });
    const host = { send: () => undefined, onStart: () => undefined, onEnd: () => undefined, onProgress: () => undefined };
    const c = new BattleCoordinator(createRng('speedrun'), { repos: s.repos, content, clock: () => Date.now(), log: silentLogger(), zone: zone('mirevale'), host, metrics: createRoomMetrics('r', 'mirevale', 0) });
    const gym = LEAGUE.find((l) => l.id === 'verdant_gym')!;
    // the lv-70 creature leads
    const party = await s.repos.db.transaction((tx) => s.repos.creatures.party(tx, pid));
    await s.repos.db.transaction((tx) => s.repos.creatures.reorderParty(tx, pid, [party[1]!.id, party[0]!.id]));
    const r = await c.startNpc({ playerId: pid, sessionId: 's' }, { kind: 'league', league: gym }, null, { x: 0, z: -26 });
    if (!r.ok) throw new Error(r.detail);
    await play(c, pid, r.session);
    const mine = (await api(s, 'GET', '/speedrun', acc.access)).body;
    expect(mine.counted).toBe(true);
    expect(mine.splits.map((x: { split: string }) => x.split)).toEqual([beatSplit(STORY[0]!.id), badgeSplit('bloom')]);
    expect(mine.splits[0].playMs).toBeGreaterThanOrEqual(60_000);
    expect(RUN_START_SPLIT).toBe(beatSplit(STORY[0]!.id));
    // the finish: the board ranks it, and anyone can read the run by name
    await s.repos.db.transaction((tx) => s.repos.runs.split(tx, pid, CHAMPION_SPLIT, new Date()));
    const other = await register(s, 'glimfin', uniqueName('sr'));
    const board = (await api(s, 'GET', '/leaderboard?mode=speedrun', other.access)).body.rows;
    const row = board.find((x: { id: string }) => x.id === pid);
    expect(row.speedrunMs).toBeGreaterThanOrEqual(60_000);
    const pub = (await api(s, 'GET', `/speedrun/${acc.username}`, other.access)).body;
    expect(pub).toMatchObject({ username: acc.username, counted: true });
    expect(pub.finishMs).toBe(row.speedrunMs);
    expect((await api(s, 'GET', '/speedrun/nobody_here_x', other.access)).status).toBe(404);
  }, 120_000);
});

async function play(c: BattleCoordinator, pid: string, session: BattleSession): Promise<void> {
  for (let guard = 0; guard < 200 && c.get(session.id) !== null; guard++) {
    const st = c.get(session.id)!.state;
    const side = st.sides[0];
    if (!side.mustSwitch && st.sides[1].mustSwitch) {
      await sleep(10);
      continue;
    }
    const a: Action = side.mustSwitch
      ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
      : { kind: 'move', move: [...side.party[side.active]!.creature.moves.filter((m) => m.pp > 0)].sort((x, y) => content.move(y.id).power - content.move(x.id).power)[0]!.id };
    c.action(pid, session.id, st.turn + 1, a);
    for (let i = 0; i < 400 && c.get(session.id)?.resolving; i++) await sleep(5);
  }
}
