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
  play(tl: Timeline, seat: 0 | 1 = 0): void {
    if (this.playing) this.finishNow();
    this.seat = seat;
    this.frames = tl.frames;
    this.durationMs = tl.durationMs;
    this.index = 0;
    this.cursor = 0;
    this.freezeLeft = 0;
    this.slowLeft = 0;
    this.playing = true;
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
      if (f.k === 'hp' || f.k === 'status' || f.k === 'stage' || f.k === 'log' || f.k === 'weather' || f.k === 'orb' || f.k === 'inputLock' || f.k === 'end') this.apply(f);
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
        const ref = STAGE_POS[(f.who.side ^ this.seat) as 0 | 1];
        if (f.pose === 'enter') t.enter(f.who);
        t.setPose(ref, f.pose, f.pose === 'faint' ? 900 : f.pose === 'enter' ? 450 : f.pose === 'exit' ? 350 : 0);
        if (f.pose === 'hurt') t.hurt(ref, 0.6);
        return;
      }
      case 'flash':
        t.hurt(STAGE_POS[(f.who.side ^ this.seat) as 0 | 1], 1);
        return;
      case 'vfx':
        t.vfx(f.id, stageRef(f.from, this.seat), stageRef(f.to, this.seat), f.ms);
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
      case 'log':
        t.log(f.text, f.tone);
        return;
      case 'sfx':
        t.playSfx(f.id, stageRef(f.at3d, this.seat));
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
