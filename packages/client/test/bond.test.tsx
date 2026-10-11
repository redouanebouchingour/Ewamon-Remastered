// @vitest-environment jsdom
/**
 * The Majin / Tenjin bond cinematic (battle/bond.ts): only a trainer's transformation plays it (bandOf); the timeline
 * plays the bond frame and its sound, then the form's burst BOND_BURST_MS later (the form's own sound skipped); a wild
 * form keeps the plain burst; the player forwards the frame and clears the overlay when cut short; every form species
 * has both cut-in portraits and both sounds are in the audio manifest; the overlay shows the band's answer and clears
 * itself when its clock has run out.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPECIES, createContentIndex } from '@ewa/content';
import type { BattleEvent, BattleState, Ref } from '@ewa/core';
import { bandOf } from '../src/battle/BattleController';
import { BOND_BURST_MS, BOND_SFX, BOND_STYLE, BOND_TOTAL_MS, bondPortraits, useBondStore } from '../src/battle/bond';
import type { BondCue } from '../src/battle/bond';
import { BondCinematic } from '../src/battle/BondCinematic';
import { createMoveAnimRegistry } from '../src/battle/moveAnims';
import { TIMELINE_SFX, buildTimeline } from '../src/battle/timeline';
import type { Keyframe, TimelineCtx } from '../src/battle/timeline';
import { TimelinePlayer } from '../src/battle/TimelinePlayer';
import type { TimelineTargets } from '../src/battle/TimelinePlayer';

const content = createContentIndex();
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const A: Ref = { side: 0, slot: 0 };
const B: Ref = { side: 1, slot: 0 };

const ctx = (bondOf?: TimelineCtx['bondOf']): TimelineCtx => ({
  content,
  registry: createMoveAnimRegistry(),
  reduced: false,
  speciesOf: (r) => (r.side === 0 ? 'toxshade' : 'gemknight'),
  ...(bondOf ? { bondOf } : {}),
});
const change = (who: Ref, form: string): BattleEvent => ({ t: 'formChange', who, form, atk: 150, def: 140, spd: 90 });
const at = (fr: readonly Keyframe[], p: (f: Keyframe) => boolean): number => fr.find(p)!.at;

/** a minimal state: side 0 the player's toxshade, side 1 of `kind` with a gemknight */
function stateOf(kind: 'npc' | 'wild', format: BattleState['format'] = 'trainer'): BattleState {
  const battler = (speciesId: string) => ({ creature: { speciesId } }) as unknown as BattleState['sides'][0]['party'][0];
  const side = (k: 'player' | 'npc' | 'wild', speciesId: string) => ({ kind: k, party: [battler(speciesId)], active: 0, trainerId: k === 'npc' ? 'warden_aurelia' : null });
  return { format, sides: [side('player', 'toxshade'), side(kind, 'gemknight')] } as unknown as BattleState;
}

describe('bond cinematic: who plays it', () => {
  it('a trainer side (player or npc) with a Majin / Tenjin species; never a wild side or a raid', () => {
    expect(bandOf(stateOf('npc'), A, content)).toBe('majin');
    expect(bandOf(stateOf('npc'), B, content)).toBe('tenjin');
    expect(bandOf(stateOf('wild'), B, content)).toBeNull();
    expect(bandOf(stateOf('npc', 'raid'), B, content)).toBeNull();
  });
});

describe('bond cinematic: timeline', () => {
  it('a trainer’s band: the bond frame and its sound, then the burst BOND_BURST_MS later, without the form’s own sound', () => {
    for (const [who, form, kind] of [[A, 'majin', 'majin'], [B, 'tenjin', 'tenjin']] as const) {
      const fr = buildTimeline([change(who, form)], ctx(() => kind)).frames;
      const t0 = at(fr, (f) => f.k === 'bond');
      expect(fr.find((f) => f.k === 'bond')).toMatchObject({ who, kind, form });
      expect(fr.some((f) => f.k === 'sfx' && f.id === BOND_STYLE[kind].sfx && f.at === t0)).toBe(true);
      const burst = at(fr, (f) => f.k === 'vfx' && f.id.startsWith('form_'));
      expect(burst - t0).toBe(BOND_BURST_MS);
      expect(at(fr, (f) => f.k === 'flash')).toBe(burst);
      expect(fr.some((f) => f.k === 'sfx' && (f.id === 'raid_roar' || f.id === 'bell_toll'))).toBe(false);
      expect(at(fr, (f) => f.k === 'form')).toBeGreaterThan(burst);
    }
  });

  it('no band (a wild form, or no bondOf): the plain burst and the form’s sound, no bond frame', () => {
    for (const c of [ctx(), ctx(() => null)]) {
      const fr = buildTimeline([change(B, 'rage')], c).frames;
      expect(fr.some((f) => f.k === 'bond')).toBe(false);
      expect(fr.some((f) => f.k === 'sfx' && f.id === 'raid_roar')).toBe(true);
    }
  });

  it('the player forwards the bond frame (core ref) and clears the overlay when cut short', () => {
    const calls: string[] = [];
    const noop = (): undefined => undefined;
    const targets: TimelineTargets = {
      setPose: noop, hurt: noop, vfx: noop, setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => false,
      slowmoEnabled: () => false, playSfx: noop, hp: noop, status: noop, stage: noop, form: noop, orb: noop, enter: noop, log: noop,
      inputLock: noop, commit: noop, ended: noop,
      cinematic: (phase) => calls.push(phase),
      bond: (who, kind, form) => calls.push(`bond ${who.side} ${kind} ${form}`),
    };
    const p = new TimelinePlayer(targets);
    p.play(buildTimeline([change(B, 'tenjin')], ctx(() => 'tenjin')), 0);
    for (let i = 0; i < 10; i++) p.step(16.667);
    p.finishNow();
    expect(calls).toEqual(['bond 1 tenjin tenjin', 'clear']);
  });
});

describe('bond cinematic: assets', () => {
  it('every Majin / Tenjin species has both cut-in portraits', () => {
    const forms = SPECIES.filter((s) => s.battleForm?.kind !== undefined);
    expect(forms.length).toBeGreaterThanOrEqual(13);
    for (const s of forms) {
      const p = bondPortraits(s.id, s.battleForm!.id);
      for (const url of [p.before, p.after]) expect(existsSync(resolve(PUBLIC, `.${url}`)), url).toBe(true);
    }
  });

  it('both sounds are timeline sfx and in the shipped audio manifest', () => {
    const shipped = JSON.parse(readFileSync(resolve(PUBLIC, 'audio', 'manifest.json'), 'utf8')) as { sfx: Record<string, unknown> };
    for (const id of BOND_SFX) {
      expect(TIMELINE_SFX).toContain(id);
      expect(shipped.sfx[id], id).toBeDefined();
    }
  });
});

describe('bond cinematic: overlay', () => {
  afterEach(() => {
    cleanup();
    act(() => useBondStore.getState().clear());
    vi.useRealTimers();
  });
  const cue = (over: Partial<BondCue> = {}): BondCue => ({
    id: 1, kind: 'majin', speciesId: 'toxshade', form: 'majin', name: 'Toxshade', trainer: 'Reeve', near: false, reduced: false, ...over,
  });

  it('Majin: the trainer, the creature, the struck ledger line, REFUSED; it clears itself after BOND_TOTAL_MS', () => {
    vi.useFakeTimers();
    render(<BondCinematic />);
    act(() => useBondStore.getState().show(cue()));
    const root = screen.getByTestId('bondcinematic');
    expect(root.dataset.kind).toBe('majin');
    expect(root.dataset.side).toBe('far');
    expect(root.textContent).toContain('Reeve');
    expect(root.textContent).toContain('Unsaid');
    expect(root.textContent).toContain('Refused');
    expect(root.querySelectorAll('img')[1]!.getAttribute('src')).toBe('/signature/toxshade_majin.webp');
    act(() => vi.advanceTimersByTime(BOND_TOTAL_MS - 1));
    expect(screen.queryByTestId('bondcinematic')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('bondcinematic')).toBeNull();
  });

  it('on the battle clock: a slow world keeps it up; it ends when the clock passes the end, or stalls for 5 s', () => {
    vi.useFakeTimers();
    let t = 0;
    render(<BondCinematic />);
    act(() => useBondStore.getState().show(cue({ clock: () => t })));
    for (let i = 0; i < 40; i++) {
      t += 50;                                                  // 2 s of battle clock over 40 s of wall time
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(screen.queryByTestId('bondcinematic')).not.toBeNull();
    t = BOND_TOTAL_MS;
    act(() => vi.advanceTimersByTime(50));
    expect(screen.queryByTestId('bondcinematic')).toBeNull();
    t = 0;
    act(() => useBondStore.getState().show(cue({ id: 2, clock: () => t })));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByTestId('bondcinematic')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1500));                   // the clock never moved: a stalled timeline
    expect(screen.queryByTestId('bondcinematic')).toBeNull();
  });

  it('Tenjin: held by the trainer, HELD; reduced motion drops the cracks and the thread', () => {
    render(<BondCinematic />);
    act(() => useBondStore.getState().show(cue({ kind: 'tenjin', speciesId: 'gemknight', form: 'tenjin', name: 'Gemknight', trainer: 'Aurelia', near: true })));
    const root = screen.getByTestId('bondcinematic');
    expect(root.dataset.side).toBe('near');
    expect(root.textContent).toContain('Held by Aurelia');
    expect(root.querySelectorAll('svg path[pathLength]').length).toBeGreaterThan(10);
    act(() => useBondStore.getState().show(cue({ id: 2, kind: 'tenjin', speciesId: 'gemknight', form: 'tenjin', reduced: true })));
    expect(screen.getByTestId('bondcinematic').querySelectorAll('line[pathLength]').length).toBe(0);
  });
});
