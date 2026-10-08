/**
 * SPEC §20.5.4 — plays a Timeline inside World3D.tick at the fixed step. Holds `cursor` (timeline ms), applies every
 * frame with `at <= cursor` in order, then advances `cursor += step × currentTimeScale`: a `time { scale: 0 }`
 * (hitstop) freezes the cursor for its ms of REAL time (3 steps), a crit `time { scale: 0.35 }` slows it; both are
 * forwarded to `renderer.setTimeScale` (render coerces them to 1 when the effect flag is off, Pillar 8).
 *
 * Frames drive the stage (poses, VFX, weather), the camera (cues, shake), the canvas battle HUD (hp/status/stage/orb
 * through BattleHud — HP targets are the frames' `hpAfter`, never a client computation), the audio director and
 * the battle log sink (the controller batches it into the store at ≤ 1 / LOG_DWELL_MIN). `inputLock` brackets the
 * whole timeline. React-free and allocation-free on the step path (perf/alloc.test.ts).
 *
 * Phase D6 doubles (`play(tl, seat, actives)`): a core ref names a party index; the stage shows two battlers per side
 * at render slot = field position. The player keeps a party index → position map per side, seeded from the starting
 * state's `actives` and moved by a switch-in's `enter` pose frame (`pos`), and addresses every pose / hurt / VFX / sfx
 * at the battler's position. Singles keeps the one-battler-per-side mapping (stage slot 0).
 */
import type { Ref } from '@ewa/core';
import type { Keyframe, LogTone, Timeline } from './timeline';

type BattlerRef = { readonly side: 0 | 1; readonly slot: number };
type Pose = 'idle' | 'lunge' | 'windup' | 'hurt' | 'recoil' | 'faint' | 'enter' | 'exit' | 'celebrate';
type Cue = 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw';

/** What the player drives. World3D wires it to the renderer; tests pass recorders. */
export interface TimelineTargets {
  setPose(ref: BattlerRef, pose: Pose, ms: number): void;
  hurt(ref: BattlerRef, strength: number): void;
  vfx(id: string, from: BattlerRef | null, to: BattlerRef | null, ms: number): void;
  setWeather(kind: string): void;
  cue(shot: Cue, ms: number): void;
  shake(amp: number, ms: number): void;
  setTimeScale(s: number): void;
  /** effect gates (settings; reduced effects already removed the frames) */
  hitstopEnabled(): boolean;
  slowmoEnabled(): boolean;
  playSfx(id: string, at: BattlerRef | null): void;
  /** hp / status / stage / orb → the canvas battle HUD */
  hp(who: Ref, to: number, max: number, ms: number): void;
  status(who: Ref, status: string | null): void;
  stage(who: Ref, stat: string, delta: number): void;
  /** a battle form: the battler's sprite becomes the form's */
  form(who: Ref, form: string): void;
  orb(phase: 'throw' | 'shake' | 'catch' | 'break', n: number): void;
  /** a battler (re)enters: the controller swaps the displayed creature when the party slot changed */
  enter(who: Ref): void;
  log(text: string, tone: LogTone): void;
  inputLock(locked: boolean): void;
  /** once per step when something changed (BattleHud.commit) */
  commit(): void;
  ended(): void;
}

const STAGE_POS: readonly [BattlerRef, BattlerRef] = [
  { side: 0, slot: 0 },
  { side: 1, slot: 0 },
];
/** Phase D6: the four doubles stage refs, [stage side][field position]. */
const STAGE_POS2: readonly (readonly [BattlerRef, BattlerRef])[] = [
  [{ side: 0, slot: 0 }, { side: 0, slot: 1 }],
  [{ side: 1, slot: 0 }, { side: 1, slot: 1 }],
];
/** party slots tracked per side (core parties hold 1..6) */
const PARTY_MAX = 6;

/**
 * Core refs name party slots; the stage shows one active battler per side at slot 0, and render's stage side 0 is
 * the near (viewer's) position — so a core side maps through the viewer's seat (seat 1 of a pvp battle: side ^ 1).
 */
export function stageRef(r: Ref | null, seat: 0 | 1 = 0): BattlerRef | null {
  return r === null ? null : STAGE_POS[(r.side ^ seat) as 0 | 1];
}

export class TimelinePlayer {
  private frames: readonly Keyframe[] = [];
  private index = 0;
  private cursor = 0;
  private playing = false;
  private freezeLeft = 0;
  private slowLeft = 0;
  private slowScale = 1;
  private scale = 1;
  private durationMs = 0;
  /** the viewer's core side: core refs map to stage positions through it */
  private seat: 0 | 1 = 0;
  /** Phase D6: true while a doubles timeline plays; `posOf[side][partyIndex]` = its field position, -1 = off the field */
  private doubles = false;
  private readonly posOf: readonly [Int8Array, Int8Array] = [new Int8Array(PARTY_MAX).fill(-1), new Int8Array(PARTY_MAX).fill(-1)];

  constructor(private readonly t: TimelineTargets) {}

  get isPlaying(): boolean {
    return this.playing;
  }
  get cursorMs(): number {
    return this.cursor;
  }
  get currentTimeScale(): number {
    return this.scale;
  }
  get expectedMs(): number {
    return this.durationMs;
  }

  /**
   * Starts `tl` for the viewer in `seat`. A timeline still playing is finished first (its remaining state frames
   * applied, no effects).
   */
  play(tl: Timeline, seat: 0 | 1 = 0, actives: readonly [readonly [number, number] | undefined, readonly [number, number] | undefined] | null = null): void {
    if (this.playing) this.finishNow();
    this.seat = seat;
    this.doubles = actives !== null && actives[0] !== undefined && actives[1] !== undefined;
    if (actives !== null) this.seedPositions(actives);
    this.frames = tl.frames;
    this.durationMs = tl.durationMs;
    this.index = 0;
    this.cursor = 0;
    this.freezeLeft = 0;
    this.slowLeft = 0;
    this.playing = true;
  }

  /**
   * Phase D6: the field position of party index `slot` of core `side` — 0 in singles (the one active), the doubles
   * map's entry otherwise (-1 = not on the field).
   */
  positionOf(side: 0 | 1, slot: number): number {
    if (!this.doubles) return 0;
    return slot >= 0 && slot < PARTY_MAX ? this.posOf[side][slot]! : -1;
  }

  /** Phase D6: (re)seeds the party → position map from a state's `actives` (also between timelines: resync). */
  seedPositions(actives: readonly [readonly [number, number] | undefined, readonly [number, number] | undefined]): void {
    this.doubles = actives[0] !== undefined && actives[1] !== undefined;
    for (const side of [0, 1] as const) {
      const m = this.posOf[side];
      m.fill(-1);
      const a = actives[side];
      if (a === undefined) continue;
      if (a[0] >= 0 && a[0] < PARTY_MAX) m[a[0]] = 0;
      if (a[1] >= 0 && a[1] < PARTY_MAX) m[a[1]] = 1;
    }
  }

  /** The stage ref of a core ref (doubles: through the party → position map; an off-field battler keeps position 0). */
  private ref(r: Ref): BattlerRef {
    const st = (r.side ^ this.seat) as 0 | 1;
    if (!this.doubles) return STAGE_POS[st];
    const p = r.slot >= 0 && r.slot < PARTY_MAX ? this.posOf[r.side][r.slot]! : -1;
    return STAGE_POS2[st]![p === 1 ? 1 : 0];
  }

  private refOrNull(r: Ref | null): BattlerRef | null {
    return r === null ? null : this.ref(r);
  }

  /** One fixed step of REAL time (World3D passes 16.667). */
  step(dtMs: number): void {
    if (!this.playing) return;
    const frames = this.frames;
    while (this.index < frames.length && frames[this.index]!.at <= this.cursor) {
      const f = frames[this.index]!;
      this.index++;
      this.apply(f);
      if (!this.playing) {
        this.t.commit();
        return;
      }
    }
    this.t.commit();
    let s = 1;
    if (this.freezeLeft > 0) {
      this.freezeLeft -= dtMs;
      s = 0;
    } else if (this.slowLeft > 0) {
      this.slowLeft -= dtMs;
      s = this.slowScale;
    }
    if (s !== this.scale) {
      this.scale = s;
      this.t.setTimeScale(s);
    }
    this.cursor += dtMs * s;
  }

  /** Applies every remaining state-bearing frame immediately (hp, status, stage, pose end states, log, weather). */
  finishNow(): void {
    if (!this.playing) return;
    const frames = this.frames;
    while (this.index < frames.length) {
      const f = frames[this.index]!;
      this.index++;
      if (f.k === 'hp' || f.k === 'status' || f.k === 'stage' || f.k === 'form' || f.k === 'log' || f.k === 'weather' || f.k === 'orb' || f.k === 'inputLock' || f.k === 'end') this.apply(f);
      else if (f.k === 'pose' && (f.pose === 'faint' || f.pose === 'enter' || f.pose === 'exit')) this.apply(f);
    }
    this.t.commit();
    this.stopClock();
    this.playing = false;
  }

  /** Stops without applying anything (battle torn down). */
  stop(): void {
    this.playing = false;
    this.stopClock();
  }

  private stopClock(): void {
    this.freezeLeft = 0;
    this.slowLeft = 0;
    if (this.scale !== 1) {
      this.scale = 1;
      this.t.setTimeScale(1);
    }
  }

  private apply(f: Keyframe): void {
    const t = this.t;
    switch (f.k) {
      case 'pose': {
        if (this.doubles && f.pos !== undefined && f.who.slot >= 0 && f.who.slot < PARTY_MAX) {
          // a switch-in takes its position: whoever held it is off the field now
          const m = this.posOf[f.who.side];
          for (let i = 0; i < PARTY_MAX; i++) if (m[i] === f.pos) m[i] = -1;
          m[f.who.slot] = f.pos;
        }
        const ref = this.ref(f.who);
        if (f.pose === 'enter') t.enter(f.who);
        t.setPose(ref, f.pose, f.pose === 'faint' ? 900 : f.pose === 'enter' ? 450 : f.pose === 'exit' ? 350 : 0);
        if (f.pose === 'hurt') t.hurt(ref, 0.6);
        return;
      }
      case 'flash':
        t.hurt(this.ref(f.who), 1);
        return;
      case 'vfx':
        t.vfx(f.id, this.refOrNull(f.from), this.refOrNull(f.to), f.ms);
        return;
      case 'camera':
        t.cue(f.shot, f.ms);
        return;
      case 'shake':
        t.shake(f.amp, f.ms);
        return;
      case 'time':
        if (f.scale === 0) {
          if (t.hitstopEnabled()) this.freezeLeft = Math.max(this.freezeLeft, f.ms);
        } else if (t.slowmoEnabled()) {
          this.slowLeft = f.ms;
          this.slowScale = f.scale;
        }
        return;
      case 'chroma':
        // delivered by render: the `impact_super` VFX recipe requests the same 0.012 / 120 ms (gated by effects.chroma)
        return;
      case 'hp':
        t.hp(f.who, f.to, f.max, f.ms);
        return;
      case 'status':
        t.status(f.who, f.status);
        return;
      case 'stage':
        t.stage(f.who, f.stat, f.delta);
        return;
      case 'form':
        t.form(f.who, f.form);
        return;
      case 'log':
        t.log(f.text, f.tone);
        return;
      case 'sfx':
        t.playSfx(f.id, this.refOrNull(f.at3d));
        return;
      case 'weather':
        t.setWeather(f.kind);
        return;
      case 'orb':
        t.orb(f.phase, f.n);
        return;
      case 'inputLock':
        t.inputLock(f.locked);
        return;
      case 'end':
        this.playing = false;
        this.stopClock();
        t.ended();
        return;
    }
  }
}
