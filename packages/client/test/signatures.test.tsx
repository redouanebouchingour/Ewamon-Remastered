// @vitest-environment jsdom
/**
 * Signature move cinematics (battle/signatures.ts): every battle form's signature move in content has a cinematic, a
 * portrait in public/signature and audio-manifest sfx; the timeline plays the cut-in, then the move's windup
 * and travel uncompressed so the impact lands exactly lead + windup + travel after the cinematic frame; a battler's
 * second use plays short; the player forwards the frames and clears the overlay when a timeline is cut short; the
 * overlay mounts the cue's effect layer, skips the band when short, drops the effect layer under reduced motion and
 * clears itself when its clock has run out.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPECIES, createContentIndex } from '@ewa/content';
import type { BattleEvent, Ref } from '@ewa/core';
import { useCinematicStore } from '../src/battle/cinematic';
import type { CinematicCue } from '../src/battle/cinematic';
import { MOVE_ANIMS, createMoveAnimRegistry } from '../src/battle/moveAnims';
import { SignatureCinematic, cinematicVars } from '../src/battle/SignatureCinematic';
import { SHORT_LEAD_MS, SIGNATURE_CINEMATICS, impactAt, signatureOf, skipMs } from '../src/battle/signatures';
import { buildTimeline } from '../src/battle/timeline';
import type { Keyframe, TimelineCtx } from '../src/battle/timeline';
import { TimelinePlayer } from '../src/battle/TimelinePlayer';
import type { TimelineTargets } from '../src/battle/TimelinePlayer';

const content = createContentIndex();
/** packages/client/public (jsdom's URL is not node's: resolve from this file's path) */
const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const A: Ref = { side: 0, slot: 0 };
const B: Ref = { side: 1, slot: 0 };

const ctx = (extra: Partial<TimelineCtx> = {}): TimelineCtx => ({
  content,
  registry: createMoveAnimRegistry(),
  reduced: false,
  speciesOf: (r) => (r.side === 0 ? 'hollowmane' : 'castlemaw'),
  maxHpOf: () => 200,
  ...extra,
});

const hit = (who: Ref, target: Ref, move: string, hpAfter: number): BattleEvent[] => [
  { t: 'moveUsed', who, move, target, ppLeft: 4 },
  { t: 'damage', target, amount: 40, hpAfter, maxHp: 200, effectiveness: 1, crit: false, stab: true, cause: 'move', source: who, move },
];

const at = (frames: readonly Keyframe[], pred: (f: Keyframe) => boolean): number => frames.find(pred)?.at ?? Number.NaN;

describe('signature cinematics: data', () => {
  const forms = SPECIES.flatMap((s) => (s.battleForm?.signatureMove === undefined ? [] : [{ species: s.id, form: s.battleForm.id, move: s.battleForm.signatureMove.move }]));
  const learners = (move: string): string[] => SPECIES.filter((s) => s.moves.includes(move) || s.learnableMoves.some((e) => e.move === move)).map((s) => s.id);

  it('every battle form’s signature move and one move of every legendary / mythical has a cinematic', () => {
    expect(forms.length).toBeGreaterThan(0);
    for (const f of forms) expect(signatureOf(f.move), `${f.species}: ${f.move}`).toMatchObject({ species: f.species, portrait: `${f.species}_${f.form}` });
    const owners = new Set(Object.values(SIGNATURE_CINEMATICS).map((c) => c.species));
    // a mythical family (the Elemutt line) carries its signature on its final stage (ravatar)
    for (const sp of SPECIES.filter((s) => s.legendary && s.evolution === null)) expect(owners.has(sp.id), `${sp.id} has no signature move`).toBe(true);
  });

  it('a signature move is its owner’s alone: no other species learns it', () => {
    for (const [move, c] of Object.entries(SIGNATURE_CINEMATICS)) {
      expect(content.move(move).id, move).toBe(move);
      const form = forms.find((f) => f.move === move);
      // a battle form's move is learned by nobody (the form swaps it in); a legendary's by its owner only
      expect(learners(move), move).toEqual(form !== undefined ? [] : [c.species]);
      if (form === undefined) expect(c.portrait, move).toBe(c.species);
    }
  });

  it('a cinematic has a portrait on disk, sfx from the audio manifest and its name on two lines', () => {
    const manifest = JSON.parse(readFileSync(resolve(PUBLIC, 'audio', 'manifest.json'), 'utf8')) as { sfx: Record<string, unknown> };
    for (const [move, c] of Object.entries(SIGNATURE_CINEMATICS)) {
      expect(existsSync(resolve(PUBLIC, 'signature', `${c.portrait}.webp`)), c.portrait).toBe(true);
      for (const id of [...c.sfx, c.aimSfx]) expect(manifest.sfx[id], id).toBeDefined();
      expect(c.lines.join(move.includes(' ') ? ' ' : ''), move).toBe(move);
      expect(c.totalMs, move).toBeGreaterThan(impactAt(c) + 500);
    }
  });

  it('the move animation charges and releases on the cinematic’s beats, framed wide', () => {
    for (const [id, c] of Object.entries(SIGNATURE_CINEMATICS)) {
      expect(MOVE_ANIMS[id], id).toMatchObject({ windupMs: c.windupMs, travelMs: c.travelMs, camera: 'wide' });
    }
  });
});

describe('signature cinematics: timeline', () => {
  it('the cut-in, then the charge; the damage frame lands on the impact beat', () => {
    const c = signatureOf('Hollow Crescent')!;
    const tl = buildTimeline([{ t: 'turnStart', turn: 1 }, ...hit(A, B, 'Hollow Crescent', 120), { t: 'turnEnd', turn: 1 }], ctx());
    const start = tl.frames.find((f) => f.k === 'cinematic' && f.phase === 'start');
    expect(start).toMatchObject({ move: 'Hollow Crescent', who: A, target: B, mode: 'full' });
    const t0 = start!.at;
    expect(at(tl.frames, (f) => f.k === 'cinematic' && f.phase === 'aim')).toBe(t0 + c.leadMs);
    expect(at(tl.frames, (f) => f.k === 'pose' && f.pose === 'lunge')).toBe(t0 + c.leadMs);
    expect(at(tl.frames, (f) => f.k === 'hp')).toBe(t0 + impactAt(c));
    expect(tl.frames.filter((f) => f.k === 'sfx' && c.sfx.includes(f.id)).every((f) => f.at === t0)).toBe(true);
    // the move's own sound from the charge, in place of the type's move sfx
    expect(tl.frames.find((f) => f.k === 'sfx' && f.id === c.aimSfx)?.at).toBe(t0 + c.leadMs);
    expect(tl.frames.some((f) => f.k === 'sfx' && f.id === 'move_ghost')).toBe(false);
  });

  it('a battler’s second use (in the same events or a later turn) plays short; a plain move has no cinematic', () => {
    const c = signatureOf('Vendetta Volley')!;
    const two = buildTimeline([...hit(B, A, 'Vendetta Volley', 150), ...hit(B, A, 'Vendetta Volley', 100)], ctx());
    const starts = two.frames.filter((f): f is Extract<Keyframe, { k: 'cinematic' }> => f.k === 'cinematic' && f.phase === 'start');
    expect(starts.map((f) => f.mode)).toEqual(['full', 'short']);
    const aim2 = two.frames.filter((f) => f.k === 'cinematic' && f.phase === 'aim')[1]!;
    expect(aim2.at - starts[1]!.at).toBe(SHORT_LEAD_MS);
    const later = buildTimeline(hit(B, A, 'Vendetta Volley', 150), ctx({ signatureSeen: (r, m) => r.side === 1 && m === 'Vendetta Volley' }));
    expect(later.frames.find((f) => f.k === 'cinematic')).toMatchObject({ mode: 'short' });
    expect(skipMs(c, 'short')).toBe(c.leadMs - SHORT_LEAD_MS);
    const plain = buildTimeline(hit(A, B, 'Night Slash', 150), ctx());
    expect(plain.frames.some((f) => f.k === 'cinematic')).toBe(false);
  });

  it('the cinematic’s beats never compress, even in a turn over budget', () => {
    const c = signatureOf('Hollow Crescent')!;
    const filler: BattleEvent[] = [];
    for (let i = 0; i < 12; i++) filler.push({ t: 'statStage', target: B, stat: 'atk', delta: -1, after: -1, clamped: false, source: A, cause: 'move' });
    const tl = buildTimeline([...filler, ...hit(A, B, 'Hollow Crescent', 120), ...filler], ctx());
    const t0 = at(tl.frames, (f) => f.k === 'cinematic' && f.phase === 'start');
    expect(at(tl.frames, (f) => f.k === 'hp') - t0).toBe(impactAt(c));
  });

  it('the player’s clock runs on the timeline (slow steps, hitstop), then on the wall clock once it ends or is replaced', () => {
    const noop = (): undefined => undefined;
    const targets: TimelineTargets = {
      setPose: noop, hurt: noop, vfx: noop, setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => true,
      slowmoEnabled: () => false, playSfx: noop, hp: noop, status: noop, stage: noop, form: noop, orb: noop, enter: noop, log: noop,
      inputLock: noop, commit: noop, ended: noop,
    };
    const p = new TimelinePlayer(targets);
    let wall = 1000;
    p.play(buildTimeline(hit(A, B, 'Hollow Crescent', 150), ctx()), 0);
    const clock = p.clock(() => wall);
    for (let i = 0; i < 30; i++) p.step(16.667);
    wall += 5000;                                               // a slow world: 30 steps took 5 s of wall time
    expect(clock()).toBeCloseTo(30 * 16.667, 0);                // the overlay follows the timeline, not the wall
    while (p.isPlaying) p.step(16.667);
    const atEnd = clock();
    wall += 400;
    expect(clock()).toBeCloseTo(atEnd + 400, 5);                // ended: the wall clock from there
    p.play(buildTimeline(hit(A, B, 'Tackle', 150), ctx()), 0);
    wall += 100;
    expect(clock()).toBeCloseTo(atEnd + 500, 5);                // a new timeline never rewinds it
  });

  it('the player forwards the frames and clears the overlay when the timeline is cut short', () => {
    const calls: string[] = [];
    const noop = (): undefined => undefined;
    const targets: TimelineTargets = {
      setPose: noop, hurt: noop, vfx: noop, setWeather: noop, cue: noop, shake: noop, setTimeScale: noop, hitstopEnabled: () => false,
      slowmoEnabled: () => false, playSfx: noop, hp: noop, status: noop, stage: noop, form: noop, orb: noop, enter: noop, log: noop,
      inputLock: noop, commit: noop, ended: noop,
      cinematic: (phase, move, from, to, mode) => calls.push(`${phase} ${move} ${from?.side ?? '-'}→${to?.side ?? '-'} ${mode}`),
    };
    const p = new TimelinePlayer(targets);
    // the foe's move: core side 1 is stage side 1 for seat 0, stage side 0 for seat 1
    p.play(buildTimeline(hit(B, A, 'Vendetta Volley', 150), ctx()), 1);
    for (let i = 0; i < 80; i++) p.step(16.667);
    p.finishNow();
    expect(calls).toEqual(['start Vendetta Volley 0→1 full', 'aim Vendetta Volley 0→1 full', 'clear  -→- full']);
  });
});

describe('signature cinematics: overlay', () => {
  afterEach(() => {
    cleanup();
    act(() => useCinematicStore.getState().clear());
    vi.useRealTimers();
  });

  const cue = (o: Partial<CinematicCue> = {}): CinematicCue => ({
    id: 1, move: 'Hollow Crescent', mode: 'full', fromNear: true, from: null, to: null, reduced: false, ...o,
  });

  it('mounts the cue’s effect layer and the band, and clears itself when its clock runs out', () => {
    vi.useFakeTimers();
    render(<SignatureCinematic />);
    act(() => useCinematicStore.getState().show(cue()));
    const root = screen.getByTestId('signaturecinematic');
    expect(root.dataset.mode).toBe('full');
    expect(root.querySelector('svg use[href="#ewa-sig-blade-art"]')).not.toBeNull();
    expect(root.querySelector('img')?.getAttribute('src')).toBe('/signature/hollowmane_rage.webp');
    expect(root.style.getPropertyValue('--accent')).toBe('#e0193a');
    expect(root.textContent).toContain('Crescent');
    act(() => useCinematicStore.getState().aim(1, { x: 100, y: 500, h: 300 }, { x: 900, y: 200, h: 180 }));
    act(() => vi.advanceTimersByTime(signatureOf('Hollow Crescent')!.totalMs - 1));
    expect(screen.queryByTestId('signaturecinematic')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('signaturecinematic')).toBeNull();
  });

  it('with a timeline clock the overlay lives until the clock (not the wall) passes its length', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    let t = 0;
    render(<SignatureCinematic />);
    act(() => useCinematicStore.getState().show(cue({ clock: () => t })));
    const life = signatureOf('Hollow Crescent')!.totalMs;
    act(() => vi.advanceTimersByTime(life + 1000));           // a slow world: the wall clock is past the end …
    expect(screen.queryByTestId('signaturecinematic')).not.toBeNull();
    t = life;                                                   // … the timeline gets there
    act(() => vi.advanceTimersByTime(50));
    expect(screen.queryByTestId('signaturecinematic')).toBeNull();
  });

  it('short skips the band; reduced keeps the name card and drops the effect layer', () => {
    render(<SignatureCinematic />);
    act(() => useCinematicStore.getState().show(cue({ move: 'Vendetta Volley', mode: 'short' })));
    let root = screen.getByTestId('signaturecinematic');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelectorAll('svg rect[rx="4"]')).toHaveLength(8);
    act(() => useCinematicStore.getState().show(cue({ id: 2, reduced: true })));
    root = screen.getByTestId('signaturecinematic');
    expect(root.querySelector('img')).not.toBeNull();
    expect(root.querySelector('svg use[href="#ewa-sig-blade-art"]')).toBeNull();
  });

  it('aims along the line between the battlers (the far attacker’s fallback mirrors the layout)', () => {
    const c = signatureOf('Hollow Crescent')!;
    const v = cinematicVars(cue({ from: { x: 100, y: 500, h: 500 }, to: { x: 500, y: 500, h: 300 } }), c, 1600, 900);
    expect(v['--ang']).toBe('0.00');
    expect(v['--dist']).toBe('400.0');
    expect(v['--sa']).toBe('1.0000');
    expect(v['--skip']).toBe('0ms');
    const far = cinematicVars(cue({ fromNear: false, mode: 'short' }), c, 1600, 900);
    expect(Number(far['--ax'])).toBeGreaterThan(Number(far['--dx']));
    expect(far['--skip']).toBe(`${c.leadMs - SHORT_LEAD_MS}ms`);
  });
});
