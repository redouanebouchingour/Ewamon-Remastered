/**
 * SPEC §10.2.4 triplanar sampling with world-constant tiling.
 *
 * Why not the stock `triplanarTexture` from `three/tsl`: its implementation reads `textureXNode.value`
 * at graph-build time and constructs fresh `texture(value, uv)` nodes, so the samples keep pointing at
 * the texture object that was bound when the graph was built. The library re-points maps in place
 * (placeholder → field → hero, §10.2.1) by assigning `baseNode.value`; only `texture(baseNode, uv)`
 * (which clones with `referenceNode = baseNode`) follows that re-point. Recorded in
 * IMPLEMENTATION-NOTES.md.
 */
import type { Node, TextureNode } from 'three/webgpu';
import { normalWorldGeometry, positionWorld, texture, vec3 } from 'three/tsl';

/**
 * Keijiro's StandardTriplanar blend over the world-space position, using the geometry's world normal
 * for the weights (so the blend does not depend on the normal-mapped normal being computed).
 *
 * @param base  the material's base texture node (re-pointable)
 * @param scale tiles per metre (`1 / metres`; 1/3 for the 3 m terrain tiles)
 */
export function triplanarSample(base: TextureNode, scale: Node<'float'>, position: Node<'vec3'> = positionWorld, normal: Node<'vec3'> = normalWorldGeometry): Node<'vec4'> {
  const pos = position;
  const n = normal.abs().normalize();
  const bf = n.div(n.dot(vec3(1.0)));
  const cx = texture(base, pos.yz.mul(scale)).mul(bf.x);
  const cy = texture(base, pos.zx.mul(scale)).mul(bf.y);
  const cz = texture(base, pos.xy.mul(scale)).mul(bf.z);
  return cx.add(cy).add(cz) as Node<'vec4'>;
}
