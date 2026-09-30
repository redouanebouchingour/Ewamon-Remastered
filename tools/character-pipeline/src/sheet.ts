/**
 * One look → its 44 frames (poses.ts `frameOrder`), each a 32 × 52 straight-RGBA cell with binary alpha.
 */
import { composeFrame, Palette, type PartUse, type RampSpec } from './compose.js';
import type { Facing } from './grid.js';
import { frameOrder, type State } from './poses.js';

export interface LookDef {
  readonly id: string;
  readonly palette: Readonly<Record<string, RampSpec>>;
  readonly parts: readonly PartUse[];
}

export interface Frame {
  readonly facing: Facing;
  readonly state: State;
  readonly index: number;
  readonly rgba: Uint8Array;
  readonly tags: Uint8Array;
}

export function renderLook(look: LookDef): Frame[] {
  const palette = new Palette(look.palette);
  return frameOrder().map(({ facing, state, index, pose }) => {
    const f = composeFrame(look.parts, palette, facing, pose);
    return { facing, state, index, rgba: f.rgba, tags: f.tags };
  });
}
