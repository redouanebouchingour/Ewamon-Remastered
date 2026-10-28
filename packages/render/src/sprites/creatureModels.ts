/**
 * 3D creature bodies (addition 2026-10-28, IMPLEMENTATION-NOTES "3D creatures"): the OpenSCAD models built by
 * `tools/creature-models` into `/creature-models/<sprite id>.glb`, drawn in place of the billboard card while the
 * pool's models are on (`BillboardPool.setModels`) and the creature's GLB has loaded. The card stays the fallback.
 *
 * - Each GLB is one mesh, 1 m tall, feet on y = 0, facing +Z, vertex colours in COLOR_0 (linear rgb) with the glow
 *   mask in its alpha (1 = emissive, the sprites' emissive mask on the model), quantized + meshopt.
 * - ONE material for every model, built from the billboard's per-object record (`BillboardUserData`, the mesh shares
 *   the card's record): variant palette, hurt flash, dissolve, type rim, the sun's rim, shiny sparkle, alpha shimmer
 *   and the evolution glow read the same names, so every billboard caller drives a model unchanged.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, FrontSide, MeshStandardNodeMaterial } from 'three/webgpu';
import type { Matrix4, Mesh, Node, Object3D } from 'three/webgpu';
import {
  abs, attribute, cameraPosition, dot, float, floor, hash, hue, mix, mrt, normalWorld, oneMinus, positionLocal, positionWorld, pow, saturation,
  sin, smoothstep, step, userData, vec2, vec3, vec4,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BILLBOARD } from './tables.js';
import type { BillboardUniforms } from './billboard.js';

const B = BILLBOARD;

/** A loaded body: its geometry and the transform the GLB's node carries (quantized positions are dequantized by it). */
export interface CreatureModel {
  readonly geometry: BufferGeometry;
  readonly matrix: Matrix4;
}

/** Where bodies come from (tests pass a synthetic one). */
export interface CreatureModelSource {
  /** The model for a sprite id; null when there is none or it failed (the card stays). Loaded once, shared. */
  model(id: string): Promise<CreatureModel | null>;
  dispose(): void;
}

export const CREATURE_MODEL = Object.freeze({
  /** Dissolve holes per metre of the unscaled 1 m model (positionLocal cells). */
  dissolveCells: 56,
  /** The front three-quarter turn (radians) a camera-facing body keeps, like the sprites' fronts. */
  frontTurn: -0.45,
  /** Alpha shimmer bands over the model's height. */
  shimmerBands: 8,
  /** Shiny sparkle cells per metre. */
  sparkleCells: 18,
  /**
   * Glow-mask emissive (× albedo). Lower than the card's 1.8: a model's glowing parts are whole surfaces (rings, flames,
   * cores) where the card's are its brightest texels, so 1.8 blooms them white; 1.35 keeps bright colours just over
   * the 1.15 bloom threshold.
   */
  emissiveGain: 1.35,
});

export interface CreatureModelSourceOptions {
  /** Where `index.json` and the GLBs are served. */
  readonly baseUrl: string;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly warn?: (msg: string) => void;
}

interface IndexJson { readonly models?: Readonly<Record<string, { readonly url: string; readonly bytes?: number }>> }

/** The browser source: `index.json` once, then each GLB on first use through `GLTFLoader` + `MeshoptDecoder`. */
export function createCreatureModelSource(o: CreatureModelSourceOptions): CreatureModelSource {
  const base = o.baseUrl.endsWith('/') ? o.baseUrl : `${o.baseUrl}/`;
  const fetchJson = o.fetchJson ?? (async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<unknown>; });
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let disposed = false;
  let indexP: Promise<IndexJson['models'] | null> | null = null;
  const models = new Map<string, Promise<CreatureModel | null>>();
  const loaded: CreatureModel[] = [];
  const index = (): Promise<IndexJson['models'] | null> => {
    indexP ??= fetchJson(`${base}index.json`).then((j) => (j as IndexJson).models ?? null, (e: unknown) => {
      o.warn?.(`creature-models/index.json failed to load (${e instanceof Error ? e.message : String(e)}): creatures stay billboards`);
      return null;
    });
    return indexP;
  };
  return {
    model(id) {
      let p = models.get(id);
      if (p === undefined) {
        p = index().then(async (ix) => {
          const ref = ix?.[id];
          if (ref === undefined || disposed) return null;
          const gltf = await loader.loadAsync(`${base}${ref.url}?b=${ref.bytes ?? 0}`);
          let mesh: Mesh | null = null;
          gltf.scene.traverse((n: Object3D) => { if (mesh === null && (n as Mesh).isMesh === true) mesh = n as Mesh; });
          if (mesh === null) throw new Error('no mesh');
          const m = mesh as Mesh;
          gltf.scene.updateMatrixWorld(true);
          const g = m.geometry as BufferGeometry;
          for (const x of Array.isArray(m.material) ? m.material : [m.material]) x.dispose();
          if (!g.getAttribute('color')) g.setAttribute('color', whiteColors(g.getAttribute('position').count));
          g.name = `ewa:creature-model:${id}`;
          const model: CreatureModel = { geometry: g, matrix: m.matrixWorld.clone() };
          if (disposed) { g.dispose(); return null; }
          loaded.push(model);
          return model;
        }).catch((e: unknown) => {
          o.warn?.(`creature model '${id}' failed to load (${e instanceof Error ? e.message : String(e)})`);
          return null;
        });
        models.set(id, p);
      }
      return p;
    },
    dispose() {
      disposed = true;
      for (const m of loaded) m.geometry.dispose();
      loaded.length = 0;
      models.clear();
    },
  };
}

function whiteColors(n: number): BufferAttribute {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = 1; a[i * 4 + 1] = 1; a[i * 4 + 2] = 1; }
  return new BufferAttribute(a, 4);
}

function f(name: string): Node<'float'> { return userData(name, 'float') as unknown as Node<'float'>; }

/** The one material every creature body draws with (see the file header). */
export function createCreatureModelMaterial(u: BillboardUniforms): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  const col = attribute('color', 'vec4') as unknown as Node<'vec4'>;
  const albedo = col.rgb;
  const em = col.a;
  const h = u.harvestLevel.clamp(0, 2).div(2);

  // variant palette, hurt flash — as the card
  let c: Node<'vec3'> = hue(albedo, f('hueShift')) as unknown as Node<'vec3'>;
  c = saturation(c, f('satMul')) as unknown as Node<'vec3'>;
  c = c.mul(f('lightMul'));
  c = mix(c, vec3(1), f('hurt').mul(B.hurtFlashMix));

  // faint dissolve: holes in model space, an alpha cut like the card's
  const dissolve = f('dissolve');
  const cell = floor(positionLocal.mul(CREATURE_MODEL.dissolveCells));
  const holes = hash(cell.x.add(cell.y.mul(97)).add(cell.z.mul(9187))).lessThan(dissolve);
  const alpha = holes.select(float(0), float(1));
  const cut = float(B.alphaTest);

  const glow = f('glow');
  m.colorNode = vec4(mix(mix(c, albedo, h), vec3(1), glow), alpha);
  m.roughnessNode = float(B.roughness);
  m.metalnessNode = float(B.metalness);
  m.alphaTest = B.alphaTest;
  m.alphaTestNode = cut;
  m.maskShadowNode = alpha.greaterThan(cut);

  // rim + glow mask + shimmer + sparkle + the sun's rim — the card's emissive, on the model's normals
  const V = cameraPosition.sub(positionWorld).normalize();
  const rim = pow(oneMinus(abs(dot(normalWorld, V))), B.rimPower);
  const typeC = userData('typeColor', 'color') as unknown as Node<'vec3'>;
  const alphaGlowV = f('alphaGlow');
  const shinyOn = step(B.shinyGlow - 0.5, alphaGlowV);
  const alphaOn = alphaGlowV.sub(shinyOn.mul(B.shinyGlow));
  const shimmer = alphaOn.mul(B.shimmerAmp).mul(sin(u.animTime.mul(B.shimmerRate).add(positionLocal.y.mul(CREATURE_MODEL.shimmerBands))).mul(0.5).add(0.5));
  const sCell = floor(positionLocal.mul(CREATURE_MODEL.sparkleCells));
  const twinkle = hash(sCell.x.add(sCell.y.mul(31)).add(sCell.z.mul(977)).add(floor(u.animTime.mul(B.sparkleRate)).mul(131)));
  const sparkle = smoothstep(1 - B.sparkleDensity, 1, twinkle).mul(shinyOn).mul(B.sparkleGain);
  let sunEdge: Node<'vec3'> = vec3(0);
  if (u.sunDir !== undefined && u.sunRim !== undefined) {
    const against = dot(V.negate(), u.sunDir as unknown as Node<'vec3'>).max(0);
    const edge = pow(oneMinus(abs(dot(normalWorld, V))), B.sunRimPower);
    sunEdge = (u.sunRim as unknown as Node<'vec3'>).mul(edge).mul(mix(float(B.sunRimSide), float(1), against));
  }
  m.emissiveNode = typeC.mul(rim).mul(B.rimStrength).add(c.mul(em).mul(CREATURE_MODEL.emissiveGain)).add(c.mul(shimmer)).add(vec3(1, 0.93, 0.7).mul(sparkle)).add(sunEdge).mul(oneMinus(h))
    .add(vec3(glow.mul(B.glowGain)));

  m.mrtNode = mrt({ mask: vec2(1, f('sharp')) });   // as the card: excluded from GTAO darkening; DOF-sharp bit
  m.side = FrontSide;
  m.shadowSide = DoubleSide;
  m.name = 'ewa:creature-model';
  m.userData = { ewaClass: 'creature-model' };
  return m;
}

/** A tiny body for the warm-up frame: the model program compiles at boot (position, normal, rgba colour). */
export function warmupModelGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('color', whiteColors(3));
  g.name = 'ewa:creature-model-warmup';
  return g;
}
