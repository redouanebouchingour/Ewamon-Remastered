/**
 * Spectator mode on the client (battle/live.ts, battle/replay.ts `extendReplay`): a live match's feed plays through the
 * replay path; each poll that brings more turns plays them; the feed's outcome (it comes with the deciding turn) ends
 * it on the result card; a feed that does not reproduce stops the watching with a toast; Exit
 * stops the polling.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { createBattle, createRng, digestBattleState, projectBattler, resolveTurn } from '@ewa/core';
import type { Action, BattleState, CreateBattleOpts, SideChoice } from '@ewa/core';
import { REPLAY_BATTLE_ID } from '@ewa/protocol';
import type { LiveFeedView, ServerMessage } from '@ewa/protocol';
import { createBattleController } from '../src/battle/BattleController';
import { STEP_MS } from '../src/battle/constants';
import { setBattleActions } from '../src/battle/controllerRef';
import { watchLive } from '../src/battle/live';
import { stopReplay, useReplayStore } from '../src/battle/replay';
import { spectatorNames } from '../src/battle/replayId';
import { useNotificationsStore } from '../src/state/notifications';
import { useUiStore } from '../src/state/ui';
import { makeCreature } from './battleFuzz';

const content = createContentIndex();
const MATCH = '0b6f5a9e-4c1d-4f51-9a35-6a2f0c1d2e3f';

interface Fight {
  readonly start: unknown;
  readonly seed: [number, number, number, number];
  readonly actions: [SideChoice, SideChoice][];
  readonly digests: string[];
  readonly last: BattleState;
}

/** A two-player battle (anonymised like the server's feed), played to its end by each side's weakest damaging move. */
function fight(): Fight {
  const a = makeCreature(content, content.species('bramblecub'), 40, 'r:0:0', null);
  const b = makeCreature(content, content.species('bramblecub'), 40, 'r:1:0', null);
  const seed = [...createRng(7).snapshot()] as [number, number, number, number];
  const start = {
    zoneId: 'arena',
    terrain: 'capital',
    sides: [
      { kind: 'player' as const, party: [projectBattler(a, content)], active: 0, trainerId: 'r:0', canFlee: false, canCatch: false },
      { kind: 'player' as const, party: [projectBattler(b, content)], active: 0, trainerId: 'r:1', canFlee: false, canCatch: false },
    ],
  };
  const opts: CreateBattleOpts = { id: REPLAY_BATTLE_ID, format: 'pvp', zoneId: 'arena', terrain: 'capital', seed, sides: start.sides };
  let state = createBattle(opts, content).state;
  const digests = [digestBattleState(state)];
  const weakest = (c: typeof a): string => [...c.moves].filter((m) => content.move(m.id).power > 0).sort((x, y) => content.move(x.id).power - content.move(y.id).power)[0]!.id;
  const actions: [SideChoice, SideChoice][] = [];
  for (let i = 0; i < 200 && state.ended === null; i++) {
    const pair: [Action, Action] = [
      { kind: 'move', move: weakest(a) },
      { kind: 'move', move: weakest(b) },
    ];
    actions.push(pair);
    state = resolveTurn(state, pair, content).state;
    digests.push(digestBattleState(state));
  }
  expect(state.ended).not.toBeNull();
  expect(actions.length).toBeGreaterThan(2);
  return { start, seed, actions, digests, last: state };
}

function feedAt(f: Fight, turns: number, over: boolean): LiveFeedView {
  return {
    matchId: MATCH,
    kind: 'ranked',
    finals: true,
    players: [
      { name: 'ash', rating: 1200 },
      { name: 'gary', rating: 1190 },
    ],
    turn: turns,
    startedAt: '2026-10-27T10:00:00.000Z',
    replay: {
      format: 'pvp',
      seat: 0,
      labels: ['ash', 'gary'],
      seed: f.seed,
      start: f.start as LiveFeedView['replay']['start'],
      actions: f.actions.slice(0, turns) as LiveFeedView['replay']['actions'],
      digest: f.digests[turns]!,
    },
    outcome: over ? (f.last.ended as LiveFeedView['outcome']) : null,
  };
}

function rig() {
  const queue: (() => void)[] = [];
  const c = createBattleController({
    content,
    send: () => undefined,
    reduced: () => false,
    instantText: () => true,
    selfPosition: () => ({ x: 0, z: 0 }),
    summaryAt: () => null,
    selfId: () => 'viewer',
    raidId: () => null,
    view: null,
    defer: (fn) => fn(),
  });
  setBattleActions({ submit: (a) => c.submit(a), check: (a) => c.check(a), dismissResult: () => c.dismissResult() });
  const inject = (m: ServerMessage): void => {
    if (m.type === 'battleStart') c.onBattleStart(m);
    else if (m.type === 'battleEvents') c.onBattleEvents(m);
    else if (m.type === 'battleEnd') c.onBattleEnd(m);
  };
  /** plays every timeline out and delivers every queued message, until nothing is left */
  const settle = (): void => {
    for (let k = 0; k < 400; k++) {
      for (let i = 0; i < 4000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
      if (queue.length === 0) break;
      while (queue.length > 0) queue.shift()!();
    }
  };
  let next: LiveFeedView | null = null;
  let tick: (() => void) | null = null;
  const deps = {
    content,
    inject,
    defer: (fn: () => void): void => void queue.push(fn),
    speciesName: (id: string) => id,
    read: async (): Promise<LiveFeedView> => {
      if (next === null) throw new Error('gone');
      return next;
    },
    every: (fn: () => void) => {
      tick = fn;
      return 0 as unknown as ReturnType<typeof setInterval>;
    },
  };
  return {
    deps,
    settle,
    serve: (f: LiveFeedView | null): void => {
      next = f;
    },
    /** one poll: the timer fires and the read settles */
    poll: async (): Promise<void> => {
      tick?.();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

beforeEach(() => {
  stopReplay();
  useUiStore.getState().reset();
  useNotificationsStore.getState().clear();
});

describe('watching a live match', () => {
  it('plays what the feed has, grows with each poll, and ends on the result card with the outcome', async () => {
    const f = fight();
    const r = rig();
    expect(watchLive(feedAt(f, 0, false), r.deps)).toBe(true);
    expect(useUiStore.getState().battle?.battleId).toBe(`replay:live:${MATCH}`);
    expect(useReplayStore.getState().replay).toMatchObject({ labels: ['ash', 'gary'], shown: 0, total: 0, live: { matchId: MATCH, kind: 'ranked', finals: true, over: false } });
    r.settle();
    expect(useUiStore.getState().battle?.result).toBeNull();

    r.serve(feedAt(f, 2, false));
    await r.poll();
    r.settle();
    expect(useReplayStore.getState().replay).toMatchObject({ shown: 2, total: 2 });
    expect(useUiStore.getState().battle?.result).toBeNull();

    r.serve(feedAt(f, f.actions.length, true));
    await r.poll();
    r.settle();
    expect(useReplayStore.getState().replay).toMatchObject({ shown: f.actions.length, total: f.actions.length, live: { over: true } });
    expect(useUiStore.getState().battle?.result?.outcome).toEqual(f.last.ended);
    // a watcher is nobody's side: the end names the winner, never "You won / lost"
    const winner = (f.last.ended as { winner: 0 | 1 }).winner;
    const log = useUiStore.getState().battle!.log.map((l) => l.text);
    expect(log).toContain(`${['ash', 'gary'][winner]} won the battle!`);
    expect(log.some((t) => t.startsWith('You won') || t.startsWith('You lost'))).toBe(false);
    expect(spectatorNames(`replay:live:${MATCH}`)).toEqual(['ash', 'gary']);
    stopReplay();
    expect(spectatorNames(`replay:live:${MATCH}`)).toBeNull();
  });

  it('caught up to the turn before the end, the deciding turn arrives with the outcome and ends it', async () => {
    const f = fight();
    const r = rig();
    const n = f.actions.length;
    watchLive(feedAt(f, n - 1, false), r.deps);
    r.settle();
    expect(useReplayStore.getState().replay?.shown).toBe(n - 1);
    expect(useUiStore.getState().battle?.result).toBeNull();
    r.serve(feedAt(f, n, true));
    await r.poll();
    r.settle();
    expect(useReplayStore.getState().replay).toMatchObject({ shown: n, live: { over: true } });
    expect(useUiStore.getState().battle?.result?.outcome).toEqual(f.last.ended);
  });

  it('a feed that does not reproduce stops the watching; Exit stops the polling', async () => {
    const f = fight();
    const r = rig();
    watchLive(feedAt(f, 0, false), r.deps);
    const bad = feedAt(f, 2, false);
    r.serve({ ...bad, replay: { ...bad.replay, digest: 'ffffffff' } });
    await r.poll();
    expect(useReplayStore.getState().replay).toBeNull();
    expect(useUiStore.getState().battle).toBeNull();
    expect(useNotificationsStore.getState().toasts.at(-1)?.text).toMatch(/could not be followed/);

    const g = rig();
    watchLive(feedAt(f, 0, false), g.deps);
    stopReplay();
    g.serve(feedAt(f, 2, false));
    await g.poll();
    expect(useReplayStore.getState().replay).toBeNull();
    expect(useUiStore.getState().battle).toBeNull();
  });
});
