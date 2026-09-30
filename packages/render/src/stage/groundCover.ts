/**
 * Wild creatures readable in tall grass (IMPLEMENTATION-NOTES Part 5, T3).
 *
 * A creature billboard standing in a tall-grass patch was covered to the eyes by grass cards (the M2 audit's
 * sprite-edge shot). The reveal flattens the ground cover within ~1 m of every shown creature near the camera focus
 * through the zone's `ScatterMask` (per-instance vertical scale in the scatter tier buffers: no new mesh, material
 * or program). Creatures farther than `rangeM` from the focus keep their grass — the "wild creatures hide in tall
 * grass" fantasy for distant ones — and the disc ramps in over the outer part of the range, so the grass parts as
 * the player walks up instead of popping.
 *
 * It polls the sprite pool's live billboards every `refreshMs` (not per frame), keeps each creature on the same mask
 * slot while it stays selected (a creature idling in place rewrites nothing: `ScatterMask.set` ignores unchanged
 * discs) and allocates nothing after construction.
 */
import { Vector3 } from 'three/webgpu';
import type { BillboardPool, CreatureBillboard } from '../sprites/billboard.js';
import type { GroundCoverMask } from './battleStage.js';
import { STAGE_COVER_SLOTS } from './battleStage.js';

export const REVEAL = Object.freeze({
  /** Creatures within this horizontal distance (m) of the camera focus are revealed; farther ones stay in the grass. */
  rangeM: 15,
  /** The reveal is full inside this distance (m) and fades out toward `rangeM`. */
  fullM: 9,
  /** Grass inside `innerM` drops to `floor` of its height, easing back to full height at `outerM` (m). */
  innerM: 0.55, outerM: 1.35, floor: 0.2,
  /** The disc's floor is quantised to this step, so walking toward a creature rewrites its slice a few times, not every poll. */
  floorStep: 0.1,
  refreshMs: 150,
  /** Mask slots after the stage's arena slots (`SCATTER_MASK_SLOTS` 24 − 8). */
  slots: 16,
});

/** `COVER.ground` (zone/scatter.ts): the reveal flattens grass, tufts and flowers only. */
const COVER_GROUND = 1;

const _feet = new Vector3();

export class GroundCoverReveal {
  private mask: GroundCoverMask | null = null;
  private readonly owner: (CreatureBillboard | null)[] = new Array<CreatureBillboard | null>(REVEAL.slots).fill(null);
  private readonly pick: (CreatureBillboard | null)[] = new Array<CreatureBillboard | null>(REVEAL.slots).fill(null);
  private readonly pickD = new Float64Array(REVEAL.slots);
  private left = 0;

  constructor(private readonly pool: BillboardPool, private readonly focus: () => Vector3, private readonly slot0: number = STAGE_COVER_SLOTS) {}

  /** The loaded zone's mask (null = none); the previous mask's reveal slots are released. */
  setMask(m: GroundCoverMask | null): void {
    if (m === this.mask) return;
    this.release();
    this.mask = m;
    this.left = 0;
  }

  /** Per frame (real ms): re-selects the revealed creatures every `refreshMs`. Zero allocation. */
  update(dtMs: number): void {
    const m = this.mask;
    if (m === null) return;
    this.left -= Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    if (this.left > 0) return;
    this.left = REVEAL.refreshMs;
    const n = REVEAL.slots;
    // the ≤ n nearest shown creatures within range (insertion into a fixed sorted buffer)
    let count = 0;
    const f = this.focus();
    const live = this.pool.liveBillboards();
    const r2 = REVEAL.rangeM * REVEAL.rangeM;
    for (let i = 0; i < live.length; i++) {
      const b = live[i]!;
      if (!b.isShown()) continue;
      b.feet(_feet);
      const dx = _feet.x - f.x; const dz = _feet.z - f.z;
      const d2 = dx * dx + dz * dz;
      if (!(d2 < r2)) continue;
      let k: number;
      if (count < n) k = count++;
      else if (d2 < this.pickD[n - 1]!) k = n - 1;
      else continue;
      while (k > 0 && this.pickD[k - 1]! > d2) { this.pick[k] = this.pick[k - 1]!; this.pickD[k] = this.pickD[k - 1]!; k--; }
      this.pick[k] = b; this.pickD[k] = d2;
    }
    for (let k = count; k < n; k++) this.pick[k] = null;
    // slots whose creature is no longer picked are freed; picked creatures keep their slot, new ones take a free one
    for (let s = 0; s < n; s++) {
      const o = this.owner[s] ?? null;
      if (o !== null && this.pick.indexOf(o) < 0) { this.owner[s] = null; m.clear(this.slot0 + s); }
    }
    for (let k = 0; k < count; k++) {
      const b = this.pick[k]!;
      let s = this.owner.indexOf(b);
      if (s < 0) { s = this.owner.indexOf(null); if (s < 0) continue; this.owner[s] = b; }
      b.feet(_feet);
      const d = Math.sqrt(this.pickD[k]!);
      const t = Math.min(1, Math.max(0, (d - REVEAL.fullM) / (REVEAL.rangeM - REVEAL.fullM)));
      const fade = t * t * (3 - 2 * t);
      const floor = Math.min(1, Math.round((REVEAL.floor + (1 - REVEAL.floor) * fade) / REVEAL.floorStep) * REVEAL.floorStep);
      if (floor >= 1) { this.owner[s] = null; m.clear(this.slot0 + s); continue; }
      m.set(this.slot0 + s, _feet.x, _feet.z, REVEAL.innerM, REVEAL.outerM, floor, COVER_GROUND);
    }
  }

  /** Creatures revealed after the last poll (tests / sandbox). */
  get revealed(): number { let c = 0; for (const o of this.owner) if (o !== null) c++; return c; }

  release(): void {
    const m = this.mask;
    for (let s = 0; s < REVEAL.slots; s++) {
      if (this.owner[s] !== null && m !== null) m.clear(this.slot0 + s);
      this.owner[s] = null;
    }
  }

  dispose(): void { this.release(); this.mask = null; }
}
