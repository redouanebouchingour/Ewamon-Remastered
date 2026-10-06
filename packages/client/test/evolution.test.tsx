// @vitest-environment jsdom
/**
 * §20.5.6 (amended 2026-10-05) — the evolution sequence on the client:
 * - server truth first: the sequence starts only after `POST /creature/:id/evolve` answered, with the response's
 *   species; a failed call plays nothing (the toast explains, the prompt stays);
 * - every evolve path reaches it: the post-battle prompt (queued after the result card) and the Party screen's Rare
 *   Candy (`presentItemUse` queues the same prompt from the server's `evolveReady` event);
 * - while it plays the next prompt waits, the banner shows from the reveal ("<Name> evolved into <Species>!");
 * - `EvolutionDirector`: the world's input is locked during the sequence and restored after (HUD too), Space / Enter /
 *   Escape / a click skip, other keys pass, render's phase callbacks are deferred off the tick, listeners removed.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatureInstance } from '@ewa/core';
import type { EvolutionHandle, EvolutionPhase, SpriteDescriptor } from '@ewa/render';

vi.mock('../src/net/api', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return { ...m, apiFetch: vi.fn() };
});

import { ApiFailure, apiFetch } from '../src/net/api';
import { BANNER_ONLY_MS, setEvolutionPlayer } from '../src/app/evolution';
import type { EvolutionCallbacks, EvolutionPlayer, EvolutionRequest } from '../src/app/evolution';
import { presentItemUse } from '../src/app/itemUseFeedback';
import { EvolutionDirector } from '../src/scene/EvolutionDirector';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { EvolutionBanner } from '../src/world/EvolutionBanner';
import { PostBattlePrompts } from '../src/world/PostBattlePrompts';
import { creature, meFixture } from './fixtures';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;

interface FakePlay { req: EvolutionRequest; cb: EvolutionCallbacks; finish(): void }

function fakePlayer(order: string[] = []): { player: EvolutionPlayer; plays: FakePlay[]; preload: ReturnType<typeof vi.fn> } {
  const plays: FakePlay[] = [];
  const preload = vi.fn();
  const player: EvolutionPlayer = {
    play: (req, cb) => {
      order.push('play');
      let finish = (): void => undefined;
      const p = new Promise<void>((res) => { finish = res; });
      plays.push({ req, cb, finish: () => finish() });
      return p;
    },
    preload,
  };
  return { player, plays, preload };
}

function seat(c: CreatureInstance): void {
  useSessionStore.getState().hydrateFromMe(meFixture({ party: [c] }));
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
};

afterEach(() => {
  cleanup();
  setEvolutionPlayer(null);
  vi.useRealTimers();
});
beforeEach(() => {
  useUiStore.getState().reset();
  useSessionStore.getState().clearSession();
  useNotificationsStore.getState().clear();
  api.mockReset();
});

describe('evolution: the server confirms first', () => {
  it('a failed evolve plays nothing; a confirmed one plays the RESPONSE species after the response, then the next prompt', async () => {
    const c = creature('bramblecub', { level: 16 });
    seat(c);
    const order: string[] = [];
    const { player, plays, preload } = fakePlayer(order);
    setEvolutionPlayer(player);
    render(<><PostBattlePrompts /><EvolutionBanner /></>);
    act(() => {
      useUiStore.getState().enqueuePrompt({ kind: 'evolve', creatureId: c.id, into: 'briarbear' });
      useUiStore.getState().enqueuePrompt({ kind: 'learnMove', creatureId: c.id, move: 'Vine Whip' });
    });
    expect(screen.getByTestId('evolveprompt')).toBeTruthy();
    expect(preload).toHaveBeenCalledWith('briarbear');           // the new form's atlas binds while the prompt is read

    // 1. the server refuses: no sequence, no banner, the prompt stays, the toast says why
    api.mockRejectedValueOnce(new ApiFailure({ status: 409, code: 'notReady', detail: null }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evolve' })); });
    await flush();
    expect(plays).toHaveLength(0);
    expect(useUiStore.getState().evolution).toBeNull();
    expect(screen.queryByTestId('evolutionbanner')).toBeNull();
    expect(screen.getByTestId('evolveprompt')).toBeTruthy();
    expect(useNotificationsStore.getState().toasts.some((t) => t.level === 'danger' && t.text.includes('notReady'))).toBe(true);
    expect(useSessionStore.getState().inventory!.party[0]!.speciesId).toBe('bramblecub');

    // 2. the server confirms: the inventory writer first, then the sequence with the response's species
    api.mockImplementationOnce(async (key: string, init: { params: { id: string }; body: { into: string } }) => {
      expect(key).toBe('creatureEvolve');
      expect(init).toMatchObject({ params: { id: c.id }, body: { into: 'briarbear' } });
      order.push('response');
      return { ...c, speciesId: 'briarbear', level: 16 };
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evolve' })); });
    await flush();
    expect(order).toEqual(['response', 'play']);
    expect(plays).toHaveLength(1);
    expect(plays[0]!.req).toMatchObject({ creatureId: c.id, name: 'Bramblecub', fromSpecies: 'bramblecub', toSpecies: 'briarbear', variantKey: 'normal', isAlpha: false });
    expect(useSessionStore.getState().inventory!.party[0]!.speciesId).toBe('briarbear');
    expect(useUiStore.getState().evolution).toMatchObject({ creatureId: c.id, phase: 'playing' });
    // the evolve prompt is answered; the learn-move prompt waits for the sequence
    expect(screen.queryByTestId('evolveprompt')).toBeNull();
    expect(screen.queryByTestId('learnmoveprompt')).toBeNull();
    expect(screen.getByTestId('evolutionbanner').textContent).toContain('to skip');
    // the reveal: the banner
    act(() => plays[0]!.cb.reveal());
    expect(useUiStore.getState().evolution!.phase).toBe('revealed');
    expect(screen.getByRole('status').textContent).toBe('EvolutionBramblecub evolved into Briarbear!');
    act(() => plays[0]!.cb.leave());
    expect(screen.getByTestId('evolutionbanner').getAttribute('data-phase')).toBe('leaving');
    // the end: the banner goes, the next prompt opens
    await act(async () => { plays[0]!.finish(); });
    await flush();
    expect(useUiStore.getState().evolution).toBeNull();
    expect(screen.queryByTestId('evolutionbanner')).toBeNull();
    expect(screen.getByTestId('learnmoveprompt')).toBeTruthy();
  });

  it('Rare Candy on the Party screen: the server\'s evolveReady queues the prompt → Evolve → the same sequence', async () => {
    const c = creature('mossling', { level: 15 });
    seat(c);
    const { player, plays } = fakePlayer();
    setEvolutionPlayer(player);
    render(<PostBattlePrompts />);
    act(() => presentItemUse('rarecandy', 1, c, [{ t: 'levelUp', level: 16 }, { t: 'evolveReady', into: 'verdatide' }]));
    expect(useUiStore.getState().prompts).toEqual([{ kind: 'evolve', creatureId: c.id, into: 'verdatide' }]);
    expect(plays).toHaveLength(0);                                // a queued prompt, never automatic
    api.mockResolvedValueOnce({ ...c, speciesId: 'verdatide', level: 16 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evolve' })); });
    await flush();
    expect(plays).toHaveLength(1);
    expect(plays[0]!.req).toMatchObject({ fromSpecies: 'mossling', toSpecies: 'verdatide' });
    await act(async () => { plays[0]!.finish(); });
    await flush();
    expect(useUiStore.getState().evolution).toBeNull();
  });

  it('after a battle: the prompt queued behind the result card plays the sequence once the battle UI is gone', async () => {
    const c = creature('cindercap', { level: 18 });
    seat(c);
    const { player, plays } = fakePlayer();
    setEvolutionPlayer(player);
    render(<PostBattlePrompts />);
    act(() => {
      useUiStore.getState().setBattle({ battleId: 'b1' } as unknown as Parameters<ReturnType<typeof useUiStore.getState>['setBattle']>[0]);
      useUiStore.getState().enqueuePrompt({ kind: 'evolve', creatureId: c.id, into: 'pyrecap' });
    });
    expect(screen.queryByTestId('evolveprompt')).toBeNull();        // the result card first
    act(() => useUiStore.getState().setBattle(null));
    api.mockResolvedValueOnce({ ...c, speciesId: 'pyrecap' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evolve' })); });
    await flush();
    expect(plays.map((p) => p.req.toSpecies)).toEqual(['pyrecap']);
    await act(async () => { plays[0]!.finish(); });
  });

  it('without a world (no player) the banner alone tells it, then clears', async () => {
    vi.useFakeTimers();
    const c = creature('snapling', { level: 20 });
    seat(c);
    render(<><PostBattlePrompts /><EvolutionBanner /></>);
    act(() => useUiStore.getState().enqueuePrompt({ kind: 'evolve', creatureId: c.id, into: 'venobulb' }));
    api.mockResolvedValueOnce({ ...c, speciesId: 'venobulb' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evolve' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(useUiStore.getState().evolution?.phase).toBe('revealed');
    expect(screen.getByRole('status').textContent).toContain('evolved into');
    await act(async () => { await vi.advanceTimersByTimeAsync(BANNER_ONLY_MS + 10); });
    expect(useUiStore.getState().evolution).toBeNull();
  });
});

// ---- the world side: input lock ---------------------------------------------------------------------------------

function fakeStage() {
  let resolve: (r: 'done' | 'cancelled') => void = () => undefined;
  const skip = vi.fn();
  const cancel = vi.fn(() => resolve('cancelled'));
  let onPhase: ((p: EvolutionPhase) => void) | null = null;
  const requests: unknown[] = [];
  const stage = {
    evolution: null as { feet: { x: number; z: number } } | null,
    evolve: vi.fn((r: { onPhase: (p: EvolutionPhase) => void }) => {
      requests.push(r);
      onPhase = r.onPhase;
      stage.evolution = { feet: { x: 3, z: 4 } };
      const done = new Promise<'done' | 'cancelled'>((res) => { resolve = res; });
      const h: EvolutionHandle = { phase: 'stage', done, skip, cancel };
      return h;
    }),
  };
  return { stage, skip, cancel, requests, finish: () => resolve('done'), phase: (p: EvolutionPhase) => onPhase?.(p) };
}

const REQ: EvolutionRequest = { creatureId: 'c1', name: 'Bramblecub', fromSpecies: 'bramblecub', toSpecies: 'briarbear', variantKey: 'normal', isAlpha: false };
const DESC = { id: 'x' } as unknown as SpriteDescriptor;

describe('EvolutionDirector: the world is locked while the sequence plays, and restored after', () => {
  it('locks input + HUD, skips on Space / Enter / Escape / click only, defers phase callbacks, restores everything', async () => {
    const f = fakeStage();
    const inputs: boolean[] = []; const huds: boolean[] = [];
    const deferred: (() => void)[] = [];
    const ensure = vi.fn();
    const target = new EventTarget();
    let battle = false;
    const dir = new EvolutionDirector({
      stage: f.stage, descriptor: () => DESC, ensureSpecies: ensure, canPlay: () => true, position: () => ({ x: 1, z: 2 }), selfId: () => 'me',
      reduced: () => true, setInputEnabled: (on) => inputs.push(on), inputAfter: () => !battle, setHudVisible: (on) => huds.push(on), hudVisible: () => true,
      target, defer: (fn) => deferred.push(fn),
    });
    const cb = { reveal: vi.fn(), leave: vi.fn() };
    const run = dir.play(REQ, cb);
    expect(run).not.toBeNull();
    expect(dir.active).toBe(true);
    expect(inputs).toEqual([false]);
    expect(huds).toEqual([false]);
    expect(ensure.mock.calls.map((c) => c[0])).toEqual(['bramblecub', 'briarbear']);   // both atlases asked for
    expect(f.requests[0]).toMatchObject({ at: { x: 1, z: 2 }, reduced: true, cheer: 'me' });
    expect(dir.faceAngle(3, 0)).toBeCloseTo(0, 9);               // the creature stands at (3, 4): straight +z from (3, 0)
    // render's phase callbacks run on the tick: deferred, never synchronous
    f.phase('reveal');
    expect(cb.reveal).not.toHaveBeenCalled();
    deferred.splice(0).forEach((fn) => fn());
    expect(cb.reveal).toHaveBeenCalledTimes(1);
    f.phase('exit');
    deferred.splice(0).forEach((fn) => fn());
    expect(cb.leave).toHaveBeenCalledTimes(1);
    // skip keys are swallowed; others pass
    for (const code of ['Space', 'Enter', 'Escape']) {
      const e = new KeyboardEvent('keydown', { code, cancelable: true });
      target.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
    const w = new KeyboardEvent('keydown', { code: 'KeyW', cancelable: true });
    target.dispatchEvent(w);
    expect(w.defaultPrevented).toBe(false);
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, cancelable: true }));   // a held key skips once
    const click = new Event('pointerdown') as Event & { button: number };
    Object.defineProperty(click, 'button', { value: 0 });
    target.dispatchEvent(click);
    expect(f.skip).toHaveBeenCalledTimes(4);
    // the end restores the input and the HUD, and removes the listeners
    f.finish();
    await run;
    expect(dir.active).toBe(false);
    expect(inputs).toEqual([false, true]);
    expect(huds).toEqual([false, true]);
    target.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }));
    expect(f.skip).toHaveBeenCalledTimes(4);
    // a battle that cancels it keeps the input locked (the battle owns it)
    const g = fakeStage();
    const inputs2: boolean[] = [];
    const dir2 = new EvolutionDirector({
      stage: g.stage, descriptor: () => DESC, ensureSpecies: () => undefined, canPlay: () => true, position: () => ({ x: 0, z: 0 }), selfId: () => 'me',
      reduced: () => false, setInputEnabled: (on) => inputs2.push(on), inputAfter: () => !battle, setHudVisible: () => undefined, hudVisible: () => false,
      target, defer: (fn) => fn(),
    });
    const run2 = dir2.play(REQ, cb)!;
    battle = true;
    dir2.cancel();
    await run2;
    expect(inputs2).toEqual([false, false]);
  });

  it('cannot play (no zone / a battle / an unknown sprite): nothing is locked and the DOM falls back to the banner', () => {
    const f = fakeStage();
    const set = vi.fn();
    const base = {
      stage: f.stage, ensureSpecies: () => undefined, position: () => ({ x: 0, z: 0 }), selfId: () => 'me', reduced: () => false,
      setInputEnabled: set, inputAfter: () => true, setHudVisible: set, hudVisible: () => true, target: new EventTarget(),
    };
    expect(new EvolutionDirector({ ...base, descriptor: () => DESC, canPlay: () => false }).play(REQ, { reveal: () => undefined, leave: () => undefined })).toBeNull();
    expect(new EvolutionDirector({ ...base, descriptor: () => null, canPlay: () => true }).play(REQ, { reveal: () => undefined, leave: () => undefined })).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(f.stage.evolve).not.toHaveBeenCalled();
  });
});
