/**
 * Battle replays: a finished battle is shared (POST /history/battles/:battleId/share, the same token every time) and
 * served to anyone (GET /replay/:token, no account): the replay carries no player or creature uuid and replays with
 * core alone to its final digest. Another player's battle, an unknown token, a row written before replays were
 * recorded and a row that no longer replays are refused.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { replayBattle } from '@ewa/core';
import type { Action, BattleState, SideChoice } from '@ewa/core';
import { REPLAY_BATTLE_ID, ReplayRes } from '@ewa/protocol';
import { replayOpts } from '../src/game/replay';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, ofType, rawQuery, register, sleep, startServer, waitFor } from './helpers';
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

function spawnRecord(speciesId: string, level: number): SpawnRecord {
  return { id: `test:${Math.floor(Math.random() * 1e9)}`, speciesId, level, variantKey: 'normal', isAlpha: false, ability: content.species(speciesId).abilities[0]!, medium: 'land', x: 0, z: 6, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
}

/** A wild battle fought to its end with the lead's first move; returns its id. */
async function fightWild(acc: Account): Promise<string> {
  const j = await enter(s, acc, 'mirevale');
  const room = roomOf(j);
  const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, spawnRecord('glimp', 3), { x: 0, z: 6 });
  expect(started.ok).toBe(true);
  await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
  const battleId = ofType(j.msgs, 'battleStart')[0]!.battleId;
  let state: BattleState = ofType(j.msgs, 'battleStart')[0]!.state;
  for (let guard = 0; guard < 60 && ofType(j.msgs, 'battleEnd').length === 0; guard++) {
    const side = state.sides[0];
    const a: Action = side.mustSwitch
      ? { kind: 'switch', to: side.party.findIndex((b, i) => i !== side.active && b.creature.hp > 0) }
      : { kind: 'move', move: side.party[side.active]!.creature.moves.find((m) => m.pp > 0)!.id };
    const n = ofType(j.msgs, 'battleEvents').length;
    j.room.send('battleAction', { battleId, turn: state.turn + 1, action: a });
    await waitFor(() => ofType(j.msgs, 'battleEvents').length > n, 5000);
    state = room.battles.get(battleId)?.state ?? state;
    await sleep(260); // battleAction is limited to 4 / s (§30.6.4)
  }
  await waitFor(() => ofType(j.msgs, 'battleEnd').length === 1, 5000);
  await j.room.leave(true);
  return battleId;
}

describe('battle replays', () => {
  it('shares a battle once, serves it without an account, anonymised, replaying to its final digest', async () => {
    const acc = await register(s);
    const battleId = await fightWild(acc);
    const first = await api(s, 'POST', `/history/battles/${battleId}/share`, acc.access, {});
    expect(first.status).toBe(200);
    expect(first.body.token).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const again = await api(s, 'POST', `/history/battles/${battleId}/share`, acc.access, {});
    expect(again.body.token).toBe(first.body.token);

    const pub = await api(s, 'GET', `/replay/${first.body.token}`, null);
    expect(pub.status).toBe(200);
    expect(ReplayRes.safeParse(pub.body).success).toBe(true);
    expect(pub.body).toMatchObject({ token: first.body.token, format: 'wild', seat: 0, labels: [acc.username, null] });
    const json = JSON.stringify(pub.body);
    expect(json).not.toContain(acc.id);
    expect(json).not.toContain(battleId);
    for (const id of (await rawQuery(s.db, 'select id from creature_instances where owner_id = $1', [acc.id])).map((r) => String(r['id']))) expect(json).not.toContain(id);

    const run = replayBattle(replayOpts(REPLAY_BATTLE_ID, pub.body.format, pub.body.seed, pub.body.start), pub.body.actions as (readonly [SideChoice, SideChoice])[], content);
    expect(run.finalDigest).toBe(pub.body.finalDigest);
    expect(run.steps.at(-1)!.state.ended).not.toBeNull();
    expect(run.steps.at(-1)!.state.turn).toBe(pub.body.turns);
  }, 90_000);

  it('refuses another player, an unknown token, a battle with no replay data and one that no longer replays', async () => {
    const acc = await register(s);
    const other = await register(s);
    const battleId = await fightWild(acc);
    expect((await api(s, 'POST', `/history/battles/${battleId}/share`, other.access, {})).status).toBe(404);
    expect((await api(s, 'POST', `/history/battles/${battleId}/share`, null, {})).status).toBe(401);
    expect((await api(s, 'GET', '/replay/AAAAAAAAAAAA', null)).status).toBe(404);
    expect((await api(s, 'GET', '/replay/bad%20token', null)).status).toBe(400);

    await rawQuery(s.db, `update battle_history set final_digest = '00000000' where battle_id = $1`, [battleId]);
    expect((await api(s, 'POST', `/history/battles/${battleId}/share`, acc.access, {})).body).toMatchObject({ code: 'stale' });
    await rawQuery(s.db, 'update battle_history set start = null, final_digest = null where battle_id = $1', [battleId]);
    const old = await api(s, 'POST', `/history/battles/${battleId}/share`, acc.access, {});
    expect(old.status).toBe(409);
    expect(old.body).toMatchObject({ code: 'notReplayable' });
  }, 90_000);
});
