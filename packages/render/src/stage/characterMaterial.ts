/**
 * SPEC §10.7.7 the `'character'` material (amended 2026-10-05): ONE `MeshStandardNodeMaterial` for every character
 * body and accessory. Albedo = the look atlas sampled in the actor's tile (`userData.ewaTile`, a per-object uniform,
 * so one material and one program serve every look), roughness 0.8, metalness 0, the geometry normal (flat-shaded at
 * harvest level 2 like everything else), double-sided (capes are single sheets).
 *
 * Readability (audit M2-gym-dusk-6): a view-dependent warm rim and a small albedo floor in `emissive`, so a
 * character never turns into a black cut-out between lamp pools at night; at noon both are a few percent of the lit
 * colour. The `mask` MRT writes x 0 (GTAO applies: these are real 3D shapes) and y = `userData.sharp` (the DOF-sharp
 * local player, §10.7.3).
 *
 * The atlas is a texture node re-pointed once from a 4 × 4 placeholder to the KTX2 atlas when it arrives (the
 * placeholder stays alive until `dispose`, so no render object can re-initialise a disposed texture — H5c).
 */
import { Color, DataTexture, DoubleSide, LinearFilter, MeshStandardNodeMaterial, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three/webgpu';
import type { Node, Texture, TextureNode, UniformNode } from 'three/webgpu';
import { abs, dot, float, floor, mix, mod, mrt, normalFlat, normalView, oneMinus, positionViewDirection, pow, texture, uniform, userData, uv, vec2, vec3, vec4 } from 'three/tsl';

export const CHARACTER_MATERIAL = Object.freeze({
  /**
   * KayKit swatches are painted for flat, softly lit renders (skin #f5b993, white cloth at 0.97): under the world's
   * noon key + sky fill they clip to near white through ACES. The albedo is brought into the range of the baked world
   * surfaces (gain, linear) and its chroma restored (saturation around the luminance), measured on the sandbox lineup.
   */
  albedoGain: 0.72,
  saturation: 1.18,
  roughness: 0.8,
  metalness: 0,
  /** Emissive floor as a fraction of albedo (night readability; ≈ 2 % of the noon-lit colour). */
  floor: 0.05,
  /** Rim: strength, exponent and colour (linear). */
  rimStrength: 0.22,
  rimPower: 3,
  rim: Object.freeze([1.0, 0.92, 0.82] as const),
});

export interface CharacterMaterialUniforms {
  readonly albedoGain: UniformNode<'float', number>;
  readonly saturation: UniformNode<'float', number>;
  readonly columns: UniformNode<'float', number>;
  readonly rows: UniformNode<'float', number>;
  readonly floor: UniformNode<'float', number>;
  readonly rimStrength: UniformNode<'float', number>;
  readonly rim: UniformNode<'color', Color>;
}

export interface CharacterMaterial {
  readonly material: MeshStandardNodeMaterial;
  readonly uniforms: CharacterMaterialUniforms;
  /** The atlas texture node (re-pointed by `setAtlas`). */
  readonly atlasNode: TextureNode;
  readonly placeholder: Texture;
  setAtlas(t: Texture, columns: number, rows: number): void;
  dispose(): void;
}

/** A 4 × 4 mid-grey sRGB texture the material compiles against before the atlas arrives. */
function placeholderTexture(): DataTexture {
  const t = new DataTexture(new Uint8Array(4 * 4 * 4).fill(160), 4, 4, RGBAFormat, UnsignedByteType);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.name = 'ewa:character-atlas-placeholder';
  t.needsUpdate = true;
  return t;
}

export function createCharacterMaterial(harvestLevel: UniformNode<'float', number>): CharacterMaterial {
  const placeholder = placeholderTexture();
  const u: CharacterMaterialUniforms = {
    albedoGain: uniform(CHARACTER_MATERIAL.albedoGain).setName('ewaCharAlbedoGain'),
    saturation: uniform(CHARACTER_MATERIAL.saturation).setName('ewaCharSaturation'),
    columns: uniform(8).setName('ewaCharAtlasCols'),
    rows: uniform(4).setName('ewaCharAtlasRows'),
    floor: uniform(CHARACTER_MATERIAL.floor).setName('ewaCharFloor'),
    rimStrength: uniform(CHARACTER_MATERIAL.rimStrength).setName('ewaCharRimStrength'),
    rim: uniform(new Color(...CHARACTER_MATERIAL.rim)).setName('ewaCharRim'),
  };
  const tile = userData('ewaTile', 'float') as unknown as Node<'float'>;
  const cell = vec2(mod(tile, u.columns), floor(tile.div(u.columns)));
  const atlasUv = cell.add(uv()).div(vec2(u.columns, u.rows));
  const atlasNode = texture(placeholder, atlasUv) as unknown as TextureNode;
  const raw = (atlasNode as unknown as Node<'vec4'>).rgb;
  const lum = dot(raw, vec3(0.2126, 0.7152, 0.0722));
  const albedo = mix(vec3(lum, lum, lum), raw, u.saturation).max(0).mul(u.albedoGain) as unknown as Node<'vec3'>;
  const h = harvestLevel.clamp(0, 2).div(2) as unknown as Node<'float'>;

  const m = new MeshStandardNodeMaterial();
  m.colorNode = vec4(albedo, 1);
  m.roughnessNode = float(CHARACTER_MATERIAL.roughness);
  m.metalnessNode = float(CHARACTER_MATERIAL.metalness);
  m.normalNode = mix(normalView, normalFlat, h).normalize();
  const rim = pow(oneMinus(abs(dot(normalView, positionViewDirection))), CHARACTER_MATERIAL.rimPower);
  m.emissiveNode = albedo.mul(u.floor).add((u.rim as unknown as Node<'vec3'>).mul(rim).mul(u.rimStrength));
  m.mrtNode = mrt({ mask: vec2(0, userData('sharp', 'float') as unknown as Node<'float'>) });
  m.side = DoubleSide;
  m.name = 'ewa:character';
  m.userData = { ewaClass: 'character' };
  return {
    material: m, uniforms: u, atlasNode, placeholder,
    setAtlas(t, columns, rows) {
      atlasNode.value = t;
      u.columns.value = columns;
      u.rows.value = rows;
    },
    dispose() {
      m.dispose();
      placeholder.dispose();
    },
  };
}
