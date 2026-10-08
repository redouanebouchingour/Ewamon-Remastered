/**
 * §50.4.7 timeline.test — buildTimeline(events, ctx):
 * the 35 BattleEvent kinds each map to ≥ 1 keyframe; every turn of 1 000 fuzz battles builds a sorted timeline
 * ending in `end` with durationMs ≤ 9 000; a 40-event fixture → a committed snapshot of `at` / durations; a crit is
 * longer than the same hit without by exactly the slow-mo amount; with `reduced` every shake/time/chroma frame is
 * absent and the other frames are identical; `hp.to` = hpAfter (never a client computation); every vfx id ∈ render's
 * 47 VFX_IDS, every pose ∈ BattlerPose, every camera shot ∈ CameraRig.cue kinds; MOVE_ANIMS ≥ 40, DEFAULT_BY_TYPE 19.
 */
import { describe, expect, it } from 'vitest';
import { MOVES, createContentIndex } from '@ewa/content';
import { TYPE_NAMES } from '@ewa/core';
import type { BattleEvent, BattleState, Ref } from '@ewa/core';
import { BATTLER_POSES, CUE_KINDS, VFX_IDS } from '@ewa/render';
import { CRIT_SLOWMO, HITSTOP_MS, TURN_BUDGET } from '../src/battle/constants';
import { DEFAULT_BY_TYPE, MOVE_ANIMS, createMoveAnimRegistry } from '../src/battle/moveAnims';
import { CRIT_EXTRA_MS, buildTimeline } from '../src/battle/timeline';
import type { Keyframe, Timeline, TimelineCtx } from '../src/battle/timeline';
import { runFuzzBattle } from './battleFuzz';

const content = createContentIndex();
const registry = createMoveAnimRegistry();

function ctxFor(state: BattleState | null, reduced = false): TimelineCtx {
  return {
    content,
    registry,
    reduced,
    speciesOf: (r: Ref) => state?.sides[r.side]?.party[r.slot]?.creature.speciesId ?? 'bramblecub',
    maxHpOf: (r: Ref) => state?.sides[r.side]?.party[r.slot]?.maxHp ?? 40,
    activeOf: (s) => state?.sides[s].active ?? 0,
  };
}

const A: Ref = { side: 0, slot: 0 };
const B: Ref = { side: 1, slot: 0 };

/** One event of each of the 37 kinds. */
const ONE_OF_EACH: readonly BattleEvent[] = [
  { t: 'turnStart', turn: 1 },
  { t: 'switchOut', who: A, reason: 'action' },
  { t: 'switchIn', who: A },
  { t: 'abilityTrigger', who: A, ability: 'Intimidate', detail: 'lowered Attack' },
  { t: 'moveUsed', who: A, move: 'Vine Lash', target: B, ppLeft: 9 },
  { t: 'moveMissed', who: A, move: 'Vine Lash', target: B },
  { t: 'moveFailed', who: A, move: null, reason: 'noEffect' },
  { t: 'damage', target: B, amount: 12, hpAfter: 28, maxHp: 40, effectiveness: 2, crit: false, stab: true, cause: 'move', source: A, move: 'Vine Lash' },
  { t: 'heal', target: A, amount: 5, hpAfter: 30, cause: 'drain', item: null },
  { t: 'statusApplied', target: B, status: 'poison', source: A, turns: null },
  { t: 'statusBlocked', target: B, status: 'poison', reason: 'alreadyStatused' },
  { t: 'statusTick', target: B, status: 'sleep', detail: 'asleep' },
  { t: 'statusCured', target: B, status: 'sleep', cause: 'timer' },
  { t: 'flinch', who: B },
  { t: 'formChange', who: B, form: 'rage', atk: 180, def: 80, spd: 170 },
  { t: 'statStage', target: B, stat: 'atk', delta: -1, after: -1, clamped: false, source: A, cause: 'move' },
  { t: 'weatherSet', kind: 'rain', turns: 5, source: A },
  { t: 'weatherTick', kind: 'rain', turnsLeft: 4 },
  { t: 'weatherEnd', kind: 'rain' },
  { t: 'trapped', target: B, turns: 3, source: A },
  { t: 'trapEnd', target: B },
  { t: 'itemUsed', who: A, item: 'potion', target: A, consumedHeld: false },
  { t: 'heldItemTrigger', who: A, item: 'Sitrus Berry', consumed: true },
  { t: 'faint', who: B },
  { t: 'switchRequired', side: 1 },
  { t: 'catchThrow', orb: 'spark_orb', target: B },
  { t: 'catchShake', n: 1 },
  { t: 'catchResult', caught: false, target: B, shakes: 1 },
  { t: 'fled', side: 0 },
  { t: 'forfeit', side: 1 },
  { t: 'expGain', who: A, amount: 40, expAfter: 400 },
  { t: 'levelUp', who: A, level: 8, maxHp: 30, atk: 14, def: 12, spd: 13 },
  { t: 'learnMove', who: A, move: 'Leaf Blade', level: 8 },
  { t: 'evolveReady', who: A, into: 'bramblewolf' },
  { t: 'honor', who: A, delta: 2, honorAfter: 3, reason: 'duelWon' },
  { t: 'turnEnd', turn: 1 },
  { t: 'battleEnd', outcome: { winner: 0 }, turns: 1 },
];

const BRACKET = new Set(['inputLock', 'end']);
const poses = new Set<string>(BATTLER_POSES);
const cues = new Set<string>(CUE_KINDS);
const vfx = new Set<string>(VFX_IDS);

function assertWellFormed(tl: Timeline, where: string): void {
  const fr = tl.frames;
  for (let i = 1; i < fr.length; i++) if (fr[i]!.at < fr[i - 1]!.at) throw new Error(`${where}: unsorted at ${i}`);
  expect(fr[fr.length - 1]!.k, where).toBe('end');
  for (const f of fr) {
    if (f.k === 'vfx' && !vfx.has(f.id)) throw new Error(`${where}: vfx ${f.id}`);
    if (f.k === 'pose' && !poses.has(f.pose)) throw new Error(`${where}: pose ${f.pose}`);
    if (f.k === 'camera' && !cues.has(f.shot)) throw new Error(`${where}: shot ${f.shot}`);
  }
}

describe('buildTimeline', () => {
  it('maps each of the 37 BattleEvent kinds to at least one keyframe', () => {
    expect(new Set(ONE_OF_EACH.map((e) => e.t)).size).toBe(37);
    for (const e of ONE_OF_EACH) {
      const tl = buildTimeline([e], ctxFor(null));
      const own = tl.frames.filter((f) => !BRACKET.has(f.k));
      expect(own.length, e.t).toBeGreaterThanOrEqual(1);
      assertWellFormed(tl, e.t);
    }
  });

  it('every turn of 1 000 fuzz battles: sorted, ends in `end`, ≤ 9 000 ms, hp from hpAfter, known ids', () => {
    let turns = 0;
    let longest = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const b = runFuzzBattle(content, seed);
      const first = buildTimeline(b.start.events, ctxFor(b.start.state));
      assertWellFormed(first, `seed ${seed} start`);
      for (const t of b.turns) {
        const tl = buildTimeline(t.events, ctxFor(t.before));
        assertWellFormed(tl, `seed ${seed} turn ${t.before.turn}`);
        if (tl.durationMs > TURN_BUDGET) throw new Error(`seed ${seed} turn ${t.before.turn}: ${tl.durationMs} ms`);
        longest = Math.max(longest, tl.durationMs);
        // hp frames equal the events' hpAfter, in order
        const hpEvents = t.events.filter((e): e is Extract<BattleEvent, { t: 'damage' | 'heal' }> => e.t === 'damage' || e.t === 'heal');
        const hpFrames = tl.frames.filter((f): f is Extract<Keyframe, { k: 'hp' }> => f.k === 'hp');
        expect(hpFrames.map((f) => f.to)).toEqual(hpEvents.map((e) => e.hpAfter));
        turns++;
      }
    }
    expect(turns).toBeGreaterThan(3000);
    expect(longest).toBeLessThanOrEqual(TURN_BUDGET);
  }, 120_000);

  it('reduced: no shake / time / chroma frames, every other frame identical (hp drain ms aside)', () => {
    let compared = 0;
    let skipped = 0;
    for (let seed = 0; seed < 150; seed++) {
      const b = runFuzzBattle(content, seed);
      for (const t of b.turns) {
        const full = buildTimeline(t.events, ctxFor(t.before, false));
        const red = buildTimeline(t.events, ctxFor(t.before, true));
        expect(red.frames.some((f) => f.k === 'shake' || f.k === 'time' || f.k === 'chroma')).toBe(false);
        // a turn whose full-effects duration crossed the budget is compressed differently: compare the rest
        if (lastAt(full) !== lastAt(red)) {
          skipped++;
          continue;
        }
        const strip = (f: Keyframe): unknown => (f.k === 'hp' ? { ...f, ms: 0 } : f);
        const kept = full.frames.filter((f) => f.k !== 'shake' && f.k !== 'time' && f.k !== 'chroma').map(strip);
        expect(red.frames.map(strip)).toEqual(kept);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(300);
    expect(skipped).toBeLessThan(compared / 10);
  });

  it('a crit is longer than the same hit by exactly the slow-mo amount; hitstop adds its 50 ms', () => {
    const hit = (crit: boolean): BattleEvent[] => [
      { t: 'turnStart', turn: 1 },
      { t: 'moveUsed', who: A, move: 'Tackle', target: B, ppLeft: 30 },
      { t: 'damage', target: B, amount: 10, hpAfter: 30, maxHp: 40, effectiveness: 2, crit, stab: false, cause: 'move', source: A, move: 'Tackle' },
      { t: 'turnEnd', turn: 1 },
    ];
    const plain = buildTimeline(hit(false), ctxFor(null));
    const crit = buildTimeline(hit(true), ctxFor(null));
    expect(lastAt(crit)).toBe(lastAt(plain));
    expect(crit.durationMs - plain.durationMs).toBeCloseTo(CRIT_EXTRA_MS, 6);
    expect(CRIT_EXTRA_MS).toBeCloseTo(CRIT_SLOWMO.ms * (1 - CRIT_SLOWMO.scale), 6);
    expect(plain.durationMs - lastAt(plain)).toBe(HITSTOP_MS);
    const times = crit.frames.filter((f) => f.k === 'time');
    expect(times).toEqual([
      expect.objectContaining({ scale: 0, ms: HITSTOP_MS }),
      expect.objectContaining({ scale: CRIT_SLOWMO.scale, ms: CRIT_SLOWMO.ms }),
    ]);
    const red = buildTimeline(hit(true), ctxFor(null, true));
    expect(red.frames.some((f) => f.k === 'time')).toBe(false);
    expect(red.durationMs).toBe(lastAt(red));
  });

  it('formChange: after the hit drains, a red flash, the rage burst and the roar; the sprite swaps after them, then the line', () => {
    const hit: BattleEvent = { t: 'damage', target: B, amount: 40, hpAfter: 50, maxHp: 120, effectiveness: 1, crit: false, stab: false, cause: 'move', source: A, move: 'Tackle' };
    const tl = buildTimeline([hit, { t: 'formChange', who: B, form: 'rage', atk: 180, def: 80, spd: 170 }], ctxFor(null));
    assertWellFormed(tl, 'formChange');
    const fr = tl.frames;
    const hp = fr.find((x) => x.k === 'hp')!;
    const burst = fr.find((x) => x.k === 'vfx' && x.id === 'form_rage')!;
    const swap = fr.find((x) => x.k === 'form')!;
    expect(burst.at).toBeGreaterThan(hp.at);
    expect(fr.some((x) => x.k === 'flash' && x.at === burst.at && x.color === '#ff2a44')).toBe(true);
    expect(fr.some((x) => x.k === 'sfx' && x.id === 'raid_roar' && x.at === burst.at)).toBe(true);
    expect(swap).toMatchObject({ who: B, form: 'rage' });
    expect(swap.at).toBeGreaterThan(burst.at);
    const line = fr.filter((x) => x.k === 'log').at(-1)!;
    expect(line.k === 'log' && line.text).toMatch(/mask cracks — it flies into a rage!$/);
    expect(line.at).toBeGreaterThanOrEqual(swap.at);
  });

  it('an honor event logs one line with the ledger after the deed, good when the viewer’s creature gained', () => {
    const lines = (e: BattleEvent): Keyframe[] => buildTimeline([e], ctxFor(null)).frames.filter((f) => f.k === 'log');
    const [rose] = lines({ t: 'honor', who: A, delta: 2, honorAfter: 3, reason: 'duelWon' });
    expect(rose).toMatchObject({ k: 'log', tone: 'good' });
    expect(rose?.k === 'log' && rose.text).toMatch(/honor rose \(\+3\): a duel fairly won\.$/);
    const [fell] = lines({ t: 'honor', who: A, delta: -1, honorAfter: -2, reason: 'dirtyTrick' });
    expect(fell).toMatchObject({ k: 'log', tone: 'bad' });
    expect(fell?.k === 'log' && fell.text).toMatch(/honor fell \(-2\): a dirty trick\.$/);
  });

  it('hp frames target hpAfter / maxHp of the event', () => {
    const tl = buildTimeline(ONE_OF_EACH, ctxFor(null));
    const dmg = tl.frames.find((f) => f.k === 'hp' && f.who.side === 1);
    expect(dmg).toMatchObject({ to: 28, max: 40 });
  });

  it('a 40-event fixture matches the committed timing snapshot', () => {
    // the 35 kinds the snapshot was taken with (formChange and honor have their own tests)
    const fixture: BattleEvent[] = ONE_OF_EACH.filter((e) => e.t !== 'formChange' && e.t !== 'honor');
    fixture.push(
      { t: 'turnStart', turn: 2 },
      { t: 'moveUsed', who: B, move: 'Tackle', target: A, ppLeft: 34 },
      { t: 'damage', target: A, amount: 9, hpAfter: 21, maxHp: 30, effectiveness: 0.5, crit: true, stab: false, cause: 'move', source: B, move: 'Tackle' },
      { t: 'damage', target: B, amount: 2, hpAfter: 0, maxHp: 40, effectiveness: 1, crit: false, stab: false, cause: 'burn', source: null, move: null },
      { t: 'turnEnd', turn: 2 },
    );
    expect(fixture).toHaveLength(40);
    const tl = buildTimeline(fixture, ctxFor(null));
    const timing = tl.frames.map((f) => `${f.at.toFixed(1)} ${f.k}${'ms' in f ? `:${f.ms}` : ''}`);
    expect({ durationMs: tl.durationMs, frames: timing }).toMatchSnapshot();
  });
});

function lastAt(tl: Timeline): number {
  return tl.frames[tl.frames.length - 1]!.at;
}

describe('move animation registry', () => {
  it('Phase D7: ambient zone weather (source null, turns 0) reads as already falling, a move-set weather as starting', () => {
    const logs = (e: BattleEvent): string[] => buildTimeline([e], ctxFor(null)).frames.flatMap((f) => (f.k === 'log' ? [f.text] : []));
    expect(logs({ t: 'weatherSet', kind: 'rain', turns: 0, source: null })).toEqual(['Rain continues to fall.']);
    expect(logs({ t: 'weatherSet', kind: 'rain', turns: 5, source: A })).toEqual(['It started to rain!']);
    const frames = buildTimeline([{ t: 'weatherSet', kind: 'sand', turns: 0, source: null }], ctxFor(null)).frames;
    expect(frames.some((f) => f.k === 'weather' && f.kind === 'sand')).toBe(true);
  });

  it('MOVE_ANIMS has ≥ 40 real move ids and DEFAULT_BY_TYPE covers all 19 types', () => {
    const ids = new Set(MOVES.map((m) => m.id));
    const keys = Object.keys(MOVE_ANIMS);
    expect(keys.length).toBeGreaterThanOrEqual(40);
    expect(keys.filter((k) => !ids.has(k))).toEqual([]);
    expect(Object.keys(DEFAULT_BY_TYPE).sort()).toEqual([...TYPE_NAMES].sort());
  });

  it('every vfx the registries name is a render VFX id (set difference empty)', () => {
    const named = [...Object.values(MOVE_ANIMS), ...Object.values(DEFAULT_BY_TYPE)].map((d) => d.vfx).filter((v): v is string => v !== undefined);
    expect(named.filter((v) => !vfx.has(v))).toEqual([]);
    for (const m of MOVES) expect(vfx.has(registry.get(m.id, m).vfx), m.id).toBe(true);
  });

  it('self / field moves never travel; contact moves lunge by default', () => {
    for (const m of MOVES) {
      const d = registry.get(m.id, m);
      if (m.target === 'self' || m.target === 'field') expect(d.travelMs, m.id).toBe(0);
    }
    const tackle = MOVES.find((m) => m.id === 'Tackle')!;
    expect(registry.get('Tackle', tackle).attackerPose).toBe('lunge');
  });
});
