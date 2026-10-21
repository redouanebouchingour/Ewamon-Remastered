/**
 * World effects (SPEC §10.7.8): tall grass that makes way. The shared `push` uniforms (materials/harvest.ts) hold
 * `PUSHERS` discs the tall-grass card bends away from (materials/wind.ts `pushDisplace`: the tips lean out and press
 * down, the shadow with them). This writes them: the walkers nearest the camera focus hold one each (eased in, softer
 * while standing); a walker that leaves its slot lets the grass spring back with a damped wobble; the encounter rustle
 * takes a slot for a wide, shaking burst. Allocation-free; no mesh, material or program of its own.
 */
import type { UniformNode, Vector3, Vector4 } from 'three/webgpu';
import type { WalkerVisitor, WalkerSource } from './footsteps.js';

export const GRASS_PUSH = Object.freeze({
  /** a walker's disc (m) and how near the focus (m) a walker must be to hold one */
  radiusM: 1, rangeM: 24,
  /** strength while moving / standing, and the ease toward it (1/s) */
  moving: 1, standing: 0.6, easeRate: 9,
  /** spring-back after a walker leaves: decay time (s), wobble (Hz), end (s) */
  springTauS: 0.22, springHz: 2.4, springS: 0.9,
  /** the encounter rustle: disc (m), decay (s), shake (Hz), end (s) */
  rustleRadiusM: 2, rustleTauS: 0.45, rustleHz: 3.2, rustleS: 1.5,
});

/** Spring-back strength `t` s after release from `s0` (a damped cosine, 0 at the end). Pure. */
export function springStrength(s0: number, t: number): number {
  if (!(t >= 0) || t >= GRASS_PUSH.springS) return 0;
  return s0 * Math.exp(-t / GRASS_PUSH.springTauS) * Math.cos(2 * Math.PI * GRASS_PUSH.springHz * t);
}

/** Rustle strength `t` s after it started (a shaking burst). Pure. */
export function rustleStrength(t: number, strength = 1): number {
  if (!(t >= 0) || t >= GRASS_PUSH.rustleS) return 0;
  return 1.3 * strength * Math.exp(-t / GRASS_PUSH.rustleTauS) * Math.cos(2 * Math.PI * GRASS_PUSH.rustleHz * t);
}

const enum Mode { Free = 0, Held = 1, Spring = 2, Rustle = 3 }

const N_MAX = 8;
const _pickD = new Float64Array(N_MAX);
const _pickSlot = new Int32Array(N_MAX);

export class GrassPush {
  private readonly n: number;
  private readonly mode: Mode[];
  private readonly owner: Int32Array;     // actor slot held, -1 none
  private readonly x: Float64Array;
  private readonly z: Float64Array;
  private readonly s: Float64Array;       // current strength
  private readonly t: Float64Array;       // seconds in the spring / rustle
  private readonly s0: Float64Array;      // strength at release / rustle strength
  private readonly seen: Uint8Array;
  private picked = 0;
  private focusX = 0; private focusZ = 0;
  private dt = 0;

  constructor(private readonly uniforms: readonly UniformNode<'vec4', Vector4>[] | null) {
    this.n = Math.min(N_MAX, uniforms?.length ?? 0);
    this.mode = new Array<Mode>(this.n).fill(Mode.Free);
    this.owner = new Int32Array(this.n).fill(-1);
    this.x = new Float64Array(this.n); this.z = new Float64Array(this.n); this.s = new Float64Array(this.n);
    this.t = new Float64Array(this.n); this.s0 = new Float64Array(this.n);
    this.seen = new Uint8Array(this.n);
  }

  /** The encounter rustle at (x, z): the free slot (else the weakest) shakes the grass round it. */
  rustle(x: number, z: number, strength = 1): void {
    if (this.n === 0 || !Number.isFinite(x + z)) return;
    let k = this.mode.indexOf(Mode.Free);
    if (k < 0) { k = 0; for (let i = 1; i < this.n; i++) if (Math.abs(this.s[i]!) < Math.abs(this.s[k]!)) k = i; }
    this.mode[k] = Mode.Rustle; this.owner[k] = -1;
    this.x[k] = x; this.z[k] = z; this.t[k] = 0; this.s0[k] = strength;
  }

  /** Clears every disc (a zone change). */
  clear(): void {
    for (let i = 0; i < this.n; i++) { this.mode[i] = Mode.Free; this.owner[i] = -1; this.s[i] = 0; }
    this.write();
  }

  /** Discs in use (tests). */
  get active(): number { let c = 0; for (let i = 0; i < this.n; i++) if (this.mode[i] !== Mode.Free) c++; return c; }
  strengthOf(i: number): number { return this.s[i] ?? 0; }

  /** Per frame: `dtS` scaled seconds; the walkers near `focus` hold the discs. Zero allocation. */
  update(dtS: number, walkers: WalkerSource, focus: Vector3): void {
    if (this.n === 0) return;
    const dt = Number.isFinite(dtS) && dtS > 0 ? dtS : 0;
    this.dt = dt;
    this.focusX = focus.x; this.focusZ = focus.z;
    // the nearest walkers within range (one pass, a small sorted buffer)
    this.picked = 0;
    walkers.forEachWalker(this.pick);
    this.seen.fill(0);
    // held discs whose walker is still picked follow it; the others spring back
    for (let i = 0; i < this.n; i++) {
      if (this.mode[i] !== Mode.Held) continue;
      const at = this.indexOfPicked(this.owner[i]!);
      if (at < 0) { this.mode[i] = Mode.Spring; this.t[i] = 0; this.s0[i] = this.s[i]!; this.owner[i] = -1; continue; }
      this.seen[i] = 1;
      _pickSlot[at] = -2;    // taken
    }
    // newly picked walkers take a free (or springing) disc
    for (let k = 0; k < this.picked; k++) {
      const slot = _pickSlot[k]!;
      if (slot < 0) continue;
      let i = this.mode.indexOf(Mode.Free);
      if (i < 0) i = this.mode.indexOf(Mode.Spring);
      if (i < 0) break;
      this.mode[i] = Mode.Held; this.owner[i] = slot; this.s[i] = 0;   // eases in from flat at the walker's feet
    }
    walkers.forEachWalker(this.follow);
    const ease = 1 - Math.exp(-dt * GRASS_PUSH.easeRate);
    for (let i = 0; i < this.n; i++) {
      switch (this.mode[i]) {
        case Mode.Held: this.s[i] = this.s[i]! + (this.s0[i]! - this.s[i]!) * ease; break;
        case Mode.Spring:
          this.t[i] = this.t[i]! + dt;
          this.s[i] = springStrength(this.s0[i]!, this.t[i]!);
          if (this.t[i]! >= GRASS_PUSH.springS) { this.mode[i] = Mode.Free; this.s[i] = 0; }
          break;
        case Mode.Rustle:
          this.t[i] = this.t[i]! + dt;
          this.s[i] = rustleStrength(this.t[i]!, this.s0[i]!);
          if (this.t[i]! >= GRASS_PUSH.rustleS) { this.mode[i] = Mode.Free; this.s[i] = 0; }
          break;
        default: this.s[i] = 0;
      }
    }
    this.write();
  }

  private indexOfPicked(slot: number): number {
    for (let k = 0; k < this.picked; k++) if (_pickSlot[k] === slot) return k;
    return -1;
  }

  private readonly pick: WalkerVisitor = (slot, feet) => {
    const dx = feet.x - this.focusX; const dz = feet.z - this.focusZ;
    const d2 = dx * dx + dz * dz;
    if (!(d2 < GRASS_PUSH.rangeM * GRASS_PUSH.rangeM)) return;
    const cap = Math.min(this.n, N_MAX);
    let k: number;
    if (this.picked < cap) k = this.picked++;
    else if (d2 < _pickD[cap - 1]!) k = cap - 1;
    else return;
    while (k > 0 && _pickD[k - 1]! > d2) { _pickD[k] = _pickD[k - 1]!; _pickSlot[k] = _pickSlot[k - 1]!; k--; }
    _pickD[k] = d2; _pickSlot[k] = slot;
  };

  /** Held discs: the walker's feet and its target strength (moving or standing). */
  private readonly follow: WalkerVisitor = (slot, feet, _n, speed) => {
    for (let i = 0; i < this.n; i++) {
      if (this.mode[i] !== Mode.Held || this.owner[i] !== slot) continue;
      this.x[i] = feet.x; this.z[i] = feet.z;
      this.s0[i] = speed > 0.3 ? GRASS_PUSH.moving : GRASS_PUSH.standing;
      return;
    }
  };

  private write(): void {
    const u = this.uniforms;
    if (u === null) return;
    for (let i = 0; i < this.n; i++) {
      const r = this.mode[i] === Mode.Rustle ? GRASS_PUSH.rustleRadiusM : GRASS_PUSH.radiusM;
      u[i]!.value.set(this.x[i]!, this.z[i]!, r, this.s[i]!);
    }
  }
}
