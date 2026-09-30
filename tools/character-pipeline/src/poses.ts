/**
 * Frames: every facing × state, as poses of the paper doll.
 *
 *   state   frames  facings      notes
 *   idle    2       D U L R      breathing: the upper body (torso, arms, head) sinks 1 texel on frame 2
 *   walk    4       D U L R      contact / passing / contact / passing; the body rises 1 texel on passing frames
 *   run     4       D U L R      longer stride, knee lift, arms pumping, profile lean forward 1 texel
 *   wave    2       D            right hand raised beside the head, waving (the actor turns to the camera)
 *   cheer   2       D            both arms up; frame 2 is a 2-texel hop
 *
 * 44 frames per look. The runtime (`packages/render/src/sprites/characterAtlas.ts`) plays them by index.
 */
import type { Facing } from './grid.js';

export type LegPose =
  | 'stand' | 'stepA' | 'stepB' | 'runA' | 'runB'                                  // D/U (A = the character's right leg lifted)
  | 'strideN' | 'strideF' | 'pass' | 'runStrideN' | 'runStrideF' | 'runPassN' | 'runPassF';   // L (N = near leg forward)

export type ArmPose =
  | 'down' | 'swingA' | 'swingB' | 'pumpA' | 'pumpB' | 'wave1' | 'wave2' | 'cheer1' | 'cheer2'   // D/U
  | 'side' | 'fwd' | 'back' | 'runFwd' | 'runBack';                                            // L (the NEAR arm; the far arm mirrors it)

export interface Pose {
  readonly legs: LegPose;
  readonly arms: ArmPose;
  /** dy of the upper body (torso, arms, head, hair, hat, cape, lower garment); +1 = down. */
  readonly body: number;
  /** dx of the upper body toward the facing direction (profile run lean). */
  readonly lean: number;
  /** dy of the whole figure (the cheer hop). */
  readonly hop: number;
  /** Cape / coat-tail flare (0 still, 1 walking, 2 running). */
  readonly flare: 0 | 1 | 2;
}

export type State = 'idle' | 'walk' | 'run' | 'wave' | 'cheer';
export const STATES: readonly State[] = ['idle', 'walk', 'run', 'wave', 'cheer'];
export const FACINGS: readonly Facing[] = ['D', 'U', 'L', 'R'];

const p = (legs: LegPose, arms: ArmPose, body = 0, lean = 0, hop = 0, flare: 0 | 1 | 2 = 0): Pose => ({ legs, arms, body, lean, hop, flare });

const FRONT_BACK: Readonly<Record<'idle' | 'walk' | 'run', readonly Pose[]>> = {
  idle: [p('stand', 'down'), p('stand', 'down', 1)],
  walk: [p('stepA', 'swingB', 0, 0, 0, 1), p('stand', 'down', -1, 0, 0, 1), p('stepB', 'swingA', 0, 0, 0, 1), p('stand', 'down', -1, 0, 0, 1)],
  run: [p('runA', 'pumpB', -1, 0, 0, 2), p('stepA', 'pumpB', 0, 0, 0, 2), p('runB', 'pumpA', -1, 0, 0, 2), p('stepB', 'pumpA', 0, 0, 0, 2)],
};

const PROFILE: Readonly<Record<'idle' | 'walk' | 'run', readonly Pose[]>> = {
  idle: [p('pass', 'side'), p('pass', 'side', 1)],
  walk: [p('strideN', 'back', 0, 0, 0, 1), p('pass', 'side', -1, 0, 0, 1), p('strideF', 'fwd', 0, 0, 0, 1), p('pass', 'side', -1, 0, 0, 1)],
  run: [p('runStrideN', 'runBack', 0, 1, 0, 2), p('runPassN', 'runFwd', -1, 1, 0, 2), p('runStrideF', 'runFwd', 0, 1, 0, 2), p('runPassF', 'runBack', -1, 1, 0, 2)],
};

const EMOTES: Readonly<Record<'wave' | 'cheer', readonly Pose[]>> = {
  wave: [p('stand', 'wave1'), p('stand', 'wave2')],
  cheer: [p('stand', 'cheer1'), p('stand', 'cheer2', 0, 0, -2)],
};

/** Poses of one facing × state; emotes exist only facing the camera (D). */
export function posesFor(facing: Facing, state: State): readonly Pose[] {
  if (state === 'wave' || state === 'cheer') return facing === 'D' ? EMOTES[state] : [];
  return facing === 'L' || facing === 'R' ? PROFILE[state] : FRONT_BACK[state];
}

/** Playback rates (frames per second) at the reference speed; walk/run scale with the measured speed at runtime. */
export const FPS: Readonly<Record<State, number>> = { idle: 1.6, walk: 7, run: 11, wave: 5, cheer: 4 };

/** World distance covered by one full 4-frame cycle (m): the runtime derives walk/run fps from speed / cycle. */
export const CYCLE_M: Readonly<Record<'walk' | 'run', number>> = { walk: 1.3, run: 2.4 };

/** The frame table order: facing-major, then state, then frame — the manifest's `frames` index space. */
export function frameOrder(): { facing: Facing; state: State; index: number; pose: Pose }[] {
  const out: { facing: Facing; state: State; index: number; pose: Pose }[] = [];
  for (const facing of FACINGS) {
    for (const state of STATES) {
      posesFor(facing, state).forEach((pose, index) => out.push({ facing, state, index, pose }));
    }
  }
  return out;
}
