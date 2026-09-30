/**
 * The diorama occluder fade (IMPLEMENTATION-NOTES Part 5, audit M2-spawn-noon-9: at the Mirevale spawn the heart
 * tree's crown hid the player — 4.7 % of the player sharp in the mask shot).
 *
 * Every non-terrain library material (foliage cards, trunks, walls, roofs, props — not the triplanar ground layers, not
 * water) carries one `maskNode`: fragments inside a capsule around the segment camera → player chest, at least
 * `clearM` in front of the player, are discarded by an interleaved-gradient-noise dither, keeping `keep` of them at
 * full strength (TRAA resolves the pattern into a see-through canopy). Only render calls made with the scene camera
 * apply it: `pass` is a render-group uniform that is 1 for that camera and 0 for every other one, so shadow maps and
 * probes keep the full occluder. The inputs are uniforms written once per frame by the host (`setOcclusion`):
 * nothing is compiled or allocated at runtime; the programs carry the node from step 8 on.
 */
import { Vector3 } from 'three/webgpu';
import type { Camera, Node, UniformNode } from 'three/webgpu';
import { clamp, dot, float, fract, length, max, positionWorld, renderGroup, screenCoordinate, smoothstep, uniform, vec2 } from 'three/tsl';

export const OCCLUSION = Object.freeze({
  /** Capsule radius (m) of the full fade, and where it has eased out. */
  innerM: 1.2, outerM: 1.8,
  /** Occluders this close to the player (m, along the segment) are kept: the player's own surroundings stay. */
  clearM: 1.0,
  /** The segment ends this far above the followed feet (the chest). */
  chestM: 0.9,
  /** Share of the occluding fragments kept at full strength (the audit asks for ≤ 20 % coverage). */
  keep: 0.125,
});

export interface OcclusionUniforms {
  readonly from: UniformNode<'vec3', Vector3>;
  readonly to: UniformNode<'vec3', Vector3>;
  /** Segment parameter past which nothing is cut (1 − clearM / |segment|). */
  readonly tCut: UniformNode<'float', number>;
  /** 0 … 1 (the host fades it out as a battle / inspector shot blends in). */
  readonly strength: UniformNode<'float', number>;
  /** 1 while the scene camera renders, 0 in every other render call (shadow maps, probes). */
  readonly pass: UniformNode<'float', number>;
}

/** Host-side state of the fade: which camera's render calls apply it. */
export interface OcclusionState extends OcclusionUniforms { camera: Camera | null }

export function createOcclusionUniforms(): OcclusionState {
  const state = { camera: null as Camera | null } as OcclusionState;
  const pass = uniform(0).setGroup(renderGroup).onRenderUpdate((frame: { camera?: Camera | null }) => (state.camera !== null && frame.camera === state.camera ? 1 : 0));
  Object.assign(state, {
    from: uniform(new Vector3()).setName('ewaOccFrom'),
    to: uniform(new Vector3()).setName('ewaOccTo'),
    tCut: uniform(0).setName('ewaOccCut'),
    strength: uniform(0).setName('ewaOccStrength'),
    pass: (pass as UniformNode<'float', number>).setName('ewaOccPass'),
  });
  return state;
}

/** Per frame: the camera position, the followed feet and the fade strength (0 turns it off). Zero allocation. */
export function setOcclusion(u: OcclusionUniforms, camera: Vector3, feet: Vector3, strength: number): void {
  u.from.value.copy(camera);
  u.to.value.set(feet.x, feet.y + OCCLUSION.chestM, feet.z);
  const len = u.from.value.distanceTo(u.to.value);
  u.tCut.value = len > OCCLUSION.clearM ? 1 - OCCLUSION.clearM / len : 0;
  u.strength.value = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
}

/** The mask node: true keeps the fragment. */
export function occlusionKeep(u: OcclusionUniforms): Node<'bool'> {
  const ab = u.to.sub(u.from);
  const rel = positionWorld.sub(u.from);
  const t = clamp(dot(rel, ab).div(max(dot(ab, ab), float(1e-4))), 0, 1);
  const d = length(rel.sub(ab.mul(t)));
  const inside = float(1).sub(smoothstep(float(OCCLUSION.innerM), float(OCCLUSION.outerM), d));
  const before = float(1).sub(smoothstep(u.tCut.sub(0.02), u.tCut, t));
  const amount = inside.mul(before).mul(u.strength).mul(u.pass);
  const ign = fract(float(52.9829189).mul(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715)))));
  return ign.greaterThanEqual(amount.mul(1 - OCCLUSION.keep)) as unknown as Node<'bool'>;
}
