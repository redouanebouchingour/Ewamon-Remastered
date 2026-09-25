/**
 * SPEC §10.7.3 — `TiltShiftDOF` (Pillar 1): the focal plane passes through `rig.focus` (the followed actor's feet)
 * and is tilted 24° from the view-perpendicular toward the ground about the camera's right axis; CoC =
 * `smoothstep(0, 6 m, |d|)` × 6 px × pixelRatio; the `mask.y` MRT channel keeps sharp billboards at CoC 0.
 *
 * The TSL side lives in `post/pipeline.ts` (DOF node + plane reconstruction); this module owns the numbers and the
 * CPU mirrors the Pillar 1 test reasons with, and drives the post uniforms from the rig each frame.
 */
import { Vector3 } from 'three/webgpu';
import type { PerspectiveCamera } from 'three/webgpu';
import { tiltPlaneNormal, type PostUniforms } from '../post/pipeline.js';

// #region constants — §10.7.3 table (verbatim)
/** Focal-plane tilt from the view-perpendicular toward the ground (degrees). */
export const TILT_DEG = 24;
/** Full-blur distance from the plane (m): CoC = smoothstep(0, 6, |d|). */
export const FOCAL_LENGTH_M = 6.0;
/** Maximum CoC in CSS px (scaled by the pixel ratio). */
export const BOKEH_PX = 6;
/** `focusDistance` passed to `dof()`; the plane distance is fed as `viewZNode = −d`. */
export const FOCUS_DISTANCE = 0;
/** Pillar 1: a prop 12 m nearer/farther along the ground must reach CoC ≥ 3 px at 1440p. */
export const PILLAR1_OFFSET_M = 12;
export const PILLAR1_MIN_COC_PX = 3;
// #endregion

const DEG = Math.PI / 180;

/** CPU mirror of the node's CoC in px for a signed plane distance `d` (m) at pixel ratio `pr`. */
export function circleOfConfusionPx(d: number, pr = 1): number {
  const x = Math.min(1, Math.abs(d) / FOCAL_LENGTH_M);
  return x * x * (3 - 2 * x) * BOKEH_PX * pr;
}

/**
 * Off-plane distance of a ground point `groundOffsetM` nearer/farther along the view's horizontal direction, for a
 * camera looking down `pitchDownDeg`: the plane normal's horizontal component is `cos(pitch + tilt)` (0.2419 at the
 * diorama's 52°), so 12 m → 2.90 m.
 */
export function groundOffPlaneM(groundOffsetM: number, pitchDownDeg: number): number {
  return Math.abs(groundOffsetM) * Math.cos((pitchDownDeg + TILT_DEG) * DEG);
}

const _fwd = new Vector3();

/** Drives the post-graph DOF uniforms from the camera and the rig's focus (zero allocation). */
export class TiltShiftDOF {
  constructor(private readonly uniforms: Pick<PostUniforms, 'focusPoint' | 'planeNormal'>) {}

  update(camera: PerspectiveCamera, focus: Vector3): void {
    this.uniforms.focusPoint.value.copy(focus);
    camera.getWorldDirection(_fwd);
    tiltPlaneNormal(_fwd, this.uniforms.planeNormal.value, TILT_DEG);
  }

  /** Signed distance of a world point from the current focal plane (the CPU mirror of the post graph's `d`). */
  planeDistance(p: Vector3): number {
    const n = this.uniforms.planeNormal.value;
    const f = this.uniforms.focusPoint.value;
    return (p.x - f.x) * n.x + (p.y - f.y) * n.y + (p.z - f.z) * n.z;
  }
}
