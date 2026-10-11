/**
 * Battle-form auras (`SpriteDescriptor.aura`, `.design/majin-tenjin.md` §8): a live, looping aura around a battler that
 * holds a Majin or Tenjin form, so the form reads at a glance from any camera.
 *
 * Three layers per aura, all on the VFX clock (seconds × timeScale: hitstop freezes them, slow-mo slows them):
 * - **flames**: `AURA.particles` camera-facing particles born on the creature's outline (an ellipse fitted to the
 *   card) and rising off it, looping forever with no CPU work: each particle's age is `fract(clock × rate + seed)`.
 *   Majin: crimson flame tongues licking up and outward, flickering, with orange-hot embers spitting off. Tenjin:
 *   calm white-gold streaks rising straight up from the shoulders and head, and slow gold motes.
 * - **sigil**: a ring on the floor under the creature, the form's mark. Majin: a jagged crimson ring broken by a
 *   crack, spinning, pulsing hard. Tenjin: a whole gold ring with an inner ring, a lens circle at its centre and
 *   slowly turning ticks, pulsing gently.
 * - **rim**: the billboard's rim light takes the aura colour (HDR, pulsing), so the silhouette's edge glows and
 *   blooms in the aura colour (`CreatureBillboard.setRimColor`; `refreshTypeColor` restores the type rim).
 *
 * Budget: `AURA.slots` (4: every field position in doubles) slot pairs are built at construction and never grow:
 * one shared particle material and one shared sigil material, compiled in the warm-up frame (`warmupObjects`), with
 * per-object values read through `userData` (no new program per aura, no punctual light; C13). An idle slot is
 * invisible and costs nothing.
 */
import {
  AdditiveBlending, InstancedBufferAttribute, Mesh, MeshBasicNodeMaterial, PlaneGeometry, PointsNodeMaterial, Sprite, Vector3,
} from 'three/webgpu';
import type { Node, Object3D, PerspectiveCamera, UniformNode } from 'three/webgpu';
import {
  Fn, abs, atan, float, fract, instancedBufferAttribute, length, max, min, mix, pow, select, sin, smoothstep, step, userData, uv, vec2, vec3, vec4,
} from 'three/tsl';
import type { AuraKind } from '../contracts.js';
import { LAYERS } from '../descriptors.js';
import { OVERLAY_ALPHA_CUT, overlayMrt } from '../sprites/overlayMrt.js';
import type { CreatureBillboard } from '../sprites/billboard.js';
import { mulberry32 } from './vfx.js';

export const AURA = Object.freeze({
  /** Simultaneous auras (every field position of a doubles battle). */
  slots: 4,
  /** Particles per aura. */
  particles: 192,
  /** Fade in / out (real ms). */
  fadeInMs: 380, fadeOutMs: 260,
  /** The outline ellipse, as a fraction of the card's half width / half height (a little outside the silhouette). */
  outlineW: 0.42, outlineH: 0.52,
  /** Majin: flame cycle (s), rise (fraction of height), tongue size (fraction of height), ember share (top seeds). */
  majinCycleS: 0.55, majinRise: 0.36, majinSize: 0.12, majinEmbers: 0.16,
  /** Tenjin: streak cycle (s), rise, streak size, mote share. */
  tenjinCycleS: 1.7, tenjinRise: 0.42, tenjinSize: 0.11, tenjinMotes: 0.3,
  /** Sigil disc diameter: × the card width, at least `sigilMinM`. */
  sigilScale: 1.35, sigilMinM: 1.3, sigilLiftM: 0.025,
  /** Rim colour gain (linear HDR, × the rim's own 0.6) and its pulse. */
  rimGain: 4.2, rimPulse: 0.35,
  /**
   * Linear colours. Majin carries no blue at all: a crimson with blue in it turns pink once bloom and the tone map
   * lift it (measured in the sandbox), so the flames run orange-hot → blood red and stay fire.
   */
  majinHot: [1.0, 0.13, 0.01] as const, majinCore: [0.72, 0.0, 0.0] as const, majinRim: [1.0, 0.03, 0.0] as const,
  tenjinHot: [1.0, 0.82, 0.4] as const, tenjinCore: [0.85, 0.5, 0.08] as const, tenjinRim: [1.0, 0.72, 0.22] as const,
  /** Particle HDR gain (bloom reads > 1.15): Majin, Tenjin; sparks × `sparkGain`. */
  majinGain: 1.9, tenjinGain: 1.6, sparkGain: 1.5,
  /**
   * `majin_gold` (zenryu's Super Saiyan Majin form): Majin's motion and its crimson cracked sigil, but golden flames
   * that stand up taller and straighter (a power-up flare, not licking fire), electric-blue spark streaks for embers,
   * and a gold rim.
   */
  goldHot: [1.0, 0.8, 0.18] as const, goldCore: [1.0, 0.5, 0.0] as const, goldSpark: [0.45, 0.78, 1.0] as const,
  goldRim: [1.0, 0.74, 0.12] as const, goldRise: 0.55, goldOutward: 0.04, goldGain: 1.5, goldSize: 1.4,
});

const TAU = Math.PI * 2;
const KIND_INDEX: Readonly<Record<AuraKind, number>> = Object.freeze({ majin: 0, tenjin: 1, majin_gold: 2 });

interface Slot {
  readonly flames: Sprite;
  readonly sigil: Mesh;
  bb: CreatureBillboard | null;
  kind: AuraKind | null;
  key: string | null;
  level: number;      // 0..1
  target: number;     // 0 or 1
}

const _p = new Vector3();
const _r = new Vector3();
const _f = new Vector3();

export interface AuraDeps {
  readonly parent: Object3D;
  /** The VFX clock (seconds × timeScale) and the point-size scale, shared with `VfxSystem`. */
  readonly clock: UniformNode<'float', number>;
  readonly sizeScale: UniformNode<'float', number>;
}

export class AuraSystem {
  readonly flameMaterial: PointsNodeMaterial;
  readonly sigilMaterial: MeshBasicNodeMaterial;
  private readonly sigilGeo: PlaneGeometry;
  private readonly seeds: InstancedBufferAttribute;
  private readonly slots: Slot[] = [];
  private nowS = 0;
  private disposed = false;

  constructor(private readonly d: AuraDeps) {
    const rnd = mulberry32(0xa07a);
    const s = new Float32Array(AURA.particles * 4);
    for (let i = 0; i < s.length; i++) s[i] = rnd();
    this.seeds = new InstancedBufferAttribute(s, 4);
    this.flameMaterial = this.buildFlames();
    this.sigilMaterial = this.buildSigil();
    this.sigilGeo = new PlaneGeometry(1, 1);
    this.sigilGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < AURA.slots; i++) {
      const flames = new Sprite(this.flameMaterial);
      flames.count = AURA.particles;
      flames.frustumCulled = false;
      flames.layers.set(LAYERS.fx);
      flames.renderOrder = 11;
      flames.name = `ewa:aura-flames:${i}`;
      flames.visible = false;
      flames.castShadow = false; flames.receiveShadow = false;
      flames.userData = auraUserData(i);
      const sigil = new Mesh(this.sigilGeo, this.sigilMaterial);
      sigil.frustumCulled = false;
      sigil.layers.set(LAYERS.fx);
      sigil.renderOrder = 9;
      sigil.name = `ewa:aura-sigil:${i}`;
      sigil.visible = false;
      sigil.castShadow = false; sigil.receiveShadow = false;
      sigil.userData = { auraKind: 0, auraLevel: 0, auraSeed: i * 0.37 };
      d.parent.add(flames, sigil);
      this.slots.push({ flames, sigil, bb: null, kind: null, key: null, level: 0, target: 0 });
    }
  }

  /**
   * The aura of battler `key` (the stage's ref key): `kind` on `bb`, or null to fade it out. Re-setting the same
   * kind on the same billboard is a no-op; a new billboard under the same key takes the slot over at once.
   */
  set(key: string, bb: CreatureBillboard | null, kind: AuraKind | null): void {
    if (this.disposed) return;
    let s = this.slots.find((x) => x.key === key) ?? null;
    if (kind === null || bb === null) {
      if (s !== null) s.target = 0;
      return;
    }
    if (s === null) s = this.slots.find((x) => x.key === null) ?? this.slots.find((x) => x.target === 0) ?? null;
    if (s === null) return;   // every slot holds a live aura (cannot happen with ≤ 4 field positions)
    if (s.bb !== null && s.bb !== bb && !s.bb.isDisposed) s.bb.refreshTypeColor();
    if (s.bb !== bb) s.level = 0;
    s.key = key; s.bb = bb; s.kind = kind; s.target = 1;
    const k = KIND_INDEX[kind];
    (s.flames.userData.auraDims as Vector3).z = k;
    s.sigil.userData.auraKind = k;
  }

  /** Every aura off at once (battle end, resync, undress). */
  clear(): void {
    for (const s of this.slots) this.release(s);
  }

  /** The aura kind battler `key` shows (fading out counts as none). */
  kindOf(key: string): AuraKind | null {
    const s = this.slots.find((x) => x.key === key);
    return s !== undefined && s.target > 0 ? s.kind : null;
  }

  /** Live (visible) auras. */
  get active(): number { return this.slots.reduce((n, s) => n + (s.flames.visible ? 1 : 0), 0); }

  /** Per frame: fades, anchors (the posed card), rim pulse. Zero allocation. */
  update(dtScaledMs: number, dtRealMs: number, camera: PerspectiveCamera | null): void {
    if (this.disposed) return;
    this.nowS += Math.max(0, dtScaledMs) / 1000;
    if (camera !== null) {
      // the card plane faces the camera: right = the camera's right, back = horizontal, away from the camera
      _r.setFromMatrixColumn(camera.matrixWorld, 0); _r.y = 0;
      if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
      _r.normalize();
      _f.setFromMatrixColumn(camera.matrixWorld, 2).negate(); _f.y = 0;
      if (_f.lengthSq() < 1e-8) _f.set(0, 0, -1);
      _f.normalize();
    }
    for (const s of this.slots) {
      if (s.key === null) continue;
      const bb = s.bb;
      const gone = bb === null || bb.isDisposed;
      const step01 = s.target > 0 ? dtRealMs / AURA.fadeInMs : -dtRealMs / AURA.fadeOutMs;
      s.level = Math.min(1, Math.max(0, s.level + (Number.isFinite(step01) ? step01 : 0)));
      if (gone || (s.target === 0 && s.level <= 0)) { this.release(s); continue; }
      const shown = bb.bound && bb.isShown() && bb.dissolve < 0.5;
      const lvl = shown ? s.level : 0;
      s.flames.visible = lvl > 0.001;
      s.sigil.visible = lvl > 0.001;
      // the posed card's feet (lunges carry the aura with them) and its lift
      bb.object.getWorldPosition(_p);
      _p.y += bb.userDataRecord.lift;
      const fu = s.flames.userData;
      (fu.auraFeet as Vector3).copy(_p);
      (fu.auraRight as Vector3).copy(_r);
      (fu.auraBack as Vector3).copy(_f);
      const dims = fu.auraDims as Vector3;
      dims.x = bb.widthM; dims.y = bb.heightM;
      fu.auraLevel = lvl;
      const dia = Math.max(AURA.sigilMinM, bb.widthM * AURA.sigilScale);
      s.sigil.position.set(_p.x, _p.y - bb.userDataRecord.lift + AURA.sigilLiftM, _p.z);
      s.sigil.scale.set(dia, 1, dia);
      s.sigil.userData.auraLevel = lvl;
      // the rim: the aura colour, pulsing (Majin fast and hard, Tenjin slow and soft)
      const majin = s.kind !== 'tenjin';
      const rim = s.kind === 'majin_gold' ? AURA.goldRim : majin ? AURA.majinRim : AURA.tenjinRim;
      const pulse = 1 + AURA.rimPulse * Math.sin(this.nowS * (majin ? 9.0 : 2.4)) * (majin ? 1 : 0.6);
      const g = AURA.rimGain * pulse * Math.max(lvl, 0.0001);
      if (lvl > 0.001) bb.setRimColor(rim[0] * g, rim[1] * g, rim[2] * g);
      else bb.refreshTypeColor();
    }
  }

  /** A flames sprite + a sigil for the renderer's warm-up frame (compiles both shared materials). */
  warmupObjects(): Object3D[] {
    const f = new Sprite(this.flameMaterial);
    f.count = 1;
    f.userData = auraUserData(0);
    f.userData.auraLevel = 1;
    const m = new Mesh(this.sigilGeo, this.sigilMaterial);
    m.userData = { auraKind: 0, auraLevel: 1, auraSeed: 0 };
    return [f, m];
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    for (const s of this.slots) { s.flames.removeFromParent(); s.sigil.removeFromParent(); }
    this.flameMaterial.dispose();
    this.sigilMaterial.dispose();
    this.sigilGeo.dispose();
  }

  // ---- internals ---------------------------------------------------------------------------------------------

  private release(s: Slot): void {
    if (s.bb !== null && !s.bb.isDisposed) s.bb.refreshTypeColor();
    s.bb = null; s.kind = null; s.key = null; s.level = 0; s.target = 0;
    s.flames.visible = false; s.sigil.visible = false;
    s.flames.userData.auraLevel = 0; s.sigil.userData.auraLevel = 0;
  }

  private buildFlames(): PointsNodeMaterial {
    const m = new PointsNodeMaterial();
    const sd = instancedBufferAttribute(this.seeds) as unknown as Node<'vec4'>;
    const feet = userData('auraFeet', 'vec3') as unknown as Node<'vec3'>;
    const right = userData('auraRight', 'vec3') as unknown as Node<'vec3'>;
    const back = userData('auraBack', 'vec3') as unknown as Node<'vec3'>;
    const dims = userData('auraDims', 'vec3') as unknown as Node<'vec3'>;
    const level = userData('auraLevel', 'float') as unknown as Node<'float'>;
    const seedOff = userData('auraSeed', 'float') as unknown as Node<'float'>;
    const clock = this.d.clock;
    const w = dims.x; const h = dims.y;
    // kind: 0 Majin, 1 Tenjin, 2 Majin gold (Majin's motion in gold)
    const tenjin = step(float(0.5), dims.z).mul(step(dims.z, float(1.5)));
    const majin = float(1).sub(tenjin);                // the Majin motion (Majin and Majin gold)
    const gold = step(float(1.5), dims.z);
    // the particle's own phase: its age in [0, 1) of a cycle that varies ±30 % per seed
    const cycle = mix(float(AURA.tenjinCycleS), float(AURA.majinCycleS), majin).mul(float(0.7).add(sd.y.mul(0.6)));
    const t = clock.div(cycle).add(sd.z).add(seedOff);
    const p = fract(t);
    // sparks: the top seeds (Majin embers, Tenjin motes)
    const sparkShare = mix(float(AURA.tenjinMotes), float(AURA.majinEmbers), majin);
    const spark = step(float(1).sub(sparkShare), sd.w);
    // born on the outline ellipse: Majin all round (the lower half pulled in, so flames lick up the flanks), Tenjin
    // the upper half (shoulders and head)
    const ang = mix(sd.x.mul(Math.PI), sd.x.mul(TAU), majin);
    const ex = sin(ang.add(Math.PI / 2)).mul(w.mul(AURA.outlineW));
    const eyM = h.mul(0.5).add(sin(ang).mul(h.mul(AURA.outlineH))).max(h.mul(0.04));
    const eyT = h.mul(0.5).add(sin(ang).mul(h.mul(AURA.outlineH)));
    const ey = mix(eyT, eyM, majin);
    // motes spawn anywhere inside the body ellipse and rise slowly
    const moteX = sd.x.sub(0.5).mul(w.mul(0.9));
    const moteY = sd.z.mul(h.mul(0.8));
    const bx = mix(ex, mix(ex, moteX, tenjin), spark);
    const by = mix(ey, mix(ey, moteY, tenjin), spark);
    // rise: Majin licks up and a little outward, flickering; embers fly faster and further; Tenjin rises straight
    const riseK = mix(mix(float(AURA.tenjinRise), float(AURA.majinRise), majin), float(AURA.goldRise), gold).mul(float(0.6).add(sd.w.mul(0.8)));
    const rise = p.mul(h).mul(riseK).mul(mix(float(1), mix(float(0.5), float(2.2), majin), spark));
    const outward = sign01(ex).mul(p).mul(h).mul(mix(mix(float(0.02), float(0.12), majin), float(AURA.goldOutward), gold)).mul(mix(float(1), float(2.5), spark.mul(majin)));
    const flicker = sin(clock.mul(11).add(sd.x.mul(57))).mul(h).mul(0.035).mul(p).mul(majin);
    const x = bx.add(outward).add(flicker);
    const y = by.add(rise);
    // depth: mostly just behind the card (the creature occludes the middle; the flames show round the outline)
    const z = sd.y.sub(0.75).mul(w.mul(0.32));
    m.positionNode = feet.add(right.mul(x)).add(vec3(0, 1, 0).mul(y)).add(back.mul(z));
    // size: Majin tongues shrink as they rise, embers are specks; Tenjin streaks thin out, motes are small stars
    const base = mix(float(AURA.tenjinSize), float(AURA.majinSize), majin).mul(mix(float(1), float(AURA.goldSize), gold)).mul(h).mul(float(0.6).add(sd.y.mul(0.8)));
    const shrink = pow(float(1).sub(p), float(0.65));
    const sz = mix(base.mul(shrink), h.mul(mix(float(0.035), float(0.028), majin)), spark);
    m.sizeNode = sz.mul(this.d.sizeScale).mul(step(float(0.001), level));
    // shapes: Majin = a flame tongue (an egg, pointed up) / a square ember; Tenjin = a vertical streak / a star mote
    const q = uv().sub(0.5);
    const shape = Fn(() => {
      const tongue = smoothstep(0.5, 0.08, length(vec2(q.x.mul(float(2.1).sub(q.y.mul(1.6))), q.y.mul(1.05))));
      const ember = step(max(abs(q.x), abs(q.y)), float(0.3));
      const streak = smoothstep(0.13, 0.02, abs(q.x)).mul(smoothstep(0.5, 0.22, abs(q.y)));
      const star = max(smoothstep(0.1, 0.0, min(abs(q.x), abs(q.y)).mul(2.2)).mul(smoothstep(0.5, 0.1, length(q))), smoothstep(0.18, 0.0, length(q)));
      // Majin gold: its sparks are electric streaks rather than embers
      const majinSpark = select(gold.greaterThan(0.5), streak, ember);
      return select(majin.greaterThan(0.5), select(spark.greaterThan(0.5), majinSpark, tongue), select(spark.greaterThan(0.5), star, streak));
    })();
    // colour: hot at birth, the core colour as it rises; sparks stay hot
    const hot = mix(mix(vec3(...AURA.tenjinHot), vec3(...AURA.majinHot), majin), vec3(...AURA.goldHot), gold);
    const core = mix(mix(vec3(...AURA.tenjinCore), vec3(...AURA.majinCore), majin), vec3(...AURA.goldCore), gold);
    const sparkCol = mix(hot, vec3(...AURA.goldSpark), gold);
    const col = mix(mix(hot, core, smoothstep(0.0, 0.55, p)), sparkCol, spark);
    const gain = mix(mix(float(AURA.tenjinGain), float(AURA.majinGain), majin), float(AURA.goldGain), gold).mul(mix(float(1), float(AURA.sparkGain), spark));
    // Majin flickers in brightness, Tenjin breathes
    const breathe = mix(float(0.85).add(sin(clock.mul(2.2).add(sd.x.mul(6))).mul(0.15)), float(0.75).add(sin(clock.mul(23).add(sd.y.mul(40))).mul(0.25)), majin);
    const fade = smoothstep(0.0, 0.14, p).mul(float(1).sub(smoothstep(0.55, 1.0, p)));
    m.colorNode = vec4(col.mul(gain).mul(breathe), shape.mul(fade).mul(level));   // additive (SrcAlpha, One)
    m.transparent = true;
    m.blending = AdditiveBlending;
    m.depthWrite = false;
    m.depthTest = true;
    m.sizeAttenuation = true;
    m.fog = false;
    m.mrtNode = overlayMrt(true);
    m.alphaTest = OVERLAY_ALPHA_CUT;
    m.name = 'ewa:aura-flames';
    m.userData = { ewaClass: 'fx' };
    return m;
  }

  private buildSigil(): MeshBasicNodeMaterial {
    const m = new MeshBasicNodeMaterial();
    const kind = userData('auraKind', 'float') as unknown as Node<'float'>;
    const level = userData('auraLevel', 'float') as unknown as Node<'float'>;
    const seedOff = userData('auraSeed', 'float') as unknown as Node<'float'>;
    const clock = this.d.clock;
    const majin = float(1).sub(step(float(0.5), kind).mul(step(kind, float(1.5))));   // Majin and Majin gold: the cracked ring
    const q = uv().sub(0.5).mul(2);          // −1..1 across the disc
    const r = length(q);
    const a = atan(q.y, q.x);                // −π..π
    const ring = (radius: Node<'float'> | number, width: number): Node<'float'> =>
      smoothstep(width, 0.0, abs(r.sub(radius)));
    // ---- Majin: a jagged ring, spinning, broken by one crack, pulsing hard; a dim crimson pool inside
    const spinM = clock.mul(0.9).add(seedOff);
    const jag = sin(a.mul(9).add(spinM.mul(3))).mul(0.025).add(sin(a.mul(23).sub(spinM.mul(5))).mul(0.012));
    const crackAng = fract(a.sub(spinM).div(TAU));
    const open = smoothstep(0.03, 0.07, crackAng);   // 0 inside the crack (a gap of ~1/20 of the ring), 1 elsewhere
    const majinRing = ring(float(0.8).add(jag), 0.07).mul(open);
    const majinPool = smoothstep(0.85, 0.0, r).mul(0.22);
    const majinPulse = float(0.8).add(sin(clock.mul(7.5)).mul(0.3));
    const majinA = majinRing.add(majinPool).mul(majinPulse);
    // ---- Tenjin: an outer ring, an inner ring, a lens circle at the centre, 12 ticks turning slowly; breathing
    const spinT = clock.mul(0.22).add(seedOff);
    const ticksAng = fract(a.add(spinT).div(TAU).mul(12));
    const ticks = smoothstep(0.08, 0.0, abs(ticksAng.sub(0.5))).mul(step(0.62, r)).mul(step(r, 0.78));
    const tenjinRings = ring(0.86, 0.035).add(ring(0.6, 0.022).mul(0.8)).add(ring(0.17, 0.03)).add(ticks.mul(0.7));
    const tenjinPool = smoothstep(0.9, 0.0, r).mul(0.12);
    const tenjinPulse = float(0.85).add(sin(clock.mul(2.0)).mul(0.15));
    const tenjinA = tenjinRings.add(tenjinPool).mul(tenjinPulse);
    const alpha = mix(tenjinA, majinA, majin).mul(step(r, 1)).mul(level);
    const col = mix(vec3(...AURA.tenjinCore).mul(2.2), vec3(...AURA.majinHot).mul(0.45).add(vec3(...AURA.majinCore)).mul(2.6), majin);
    m.colorNode = vec4(col, alpha.clamp(0, 1));
    m.transparent = true;
    m.blending = AdditiveBlending;
    m.depthWrite = false;
    m.depthTest = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    m.fog = false;
    m.mrtNode = overlayMrt(false);
    m.alphaTest = OVERLAY_ALPHA_CUT;
    m.name = 'ewa:aura-sigil';
    m.userData = { ewaClass: 'fx' };
    return m;
  }
}

/** −1 / +1 by the sign of `x` (0 counts as +1). */
function sign01(x: Node<'float'>): Node<'float'> {
  return step(float(0), x).mul(2).sub(1);
}

function auraUserData(i: number): Record<string, unknown> {
  return {
    auraFeet: new Vector3(), auraRight: new Vector3(1, 0, 0), auraBack: new Vector3(0, 0, -1),
    auraDims: new Vector3(1, 1.6, 0), auraLevel: 0, auraSeed: i * 0.37,
  };
}
