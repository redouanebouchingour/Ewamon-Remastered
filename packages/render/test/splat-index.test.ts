/**
 * `splatAt`'s segment grid and precomputed yaws (layout.ts `splatIndexOf`) must not change a single bit: every field
 * at every terrain sample of every zone equals a frozen copy of the plain loops it replaced.
 */
import { describe, expect, it } from 'vitest';
import { allZones, type ZoneId } from '@ewa/content';
import {
  createSplatContext, distToPolyline, footprintDistance, inEllipse, layoutOf, roundBody, splatAt, type SplatContext, type SplatFields,
} from '../src/zone/layout.js';
import { FIELD_MARGIN } from '../src/terrain/field.js';
import { valueNoise } from '../src/zone/prng.js';
import { realSpec } from './zone-helpers.js';

/** The pre-index shore test (`createSplatContext`'s `wet`), frozen. */
const refWets = new WeakMap<SplatContext, ((x: number, z: number, d: number) => boolean) | null>();
function wetReference(c: SplatContext): ((x: number, z: number, d: number) => boolean) | null {
  if (refWets.has(c)) return refWets.get(c)!;
  const plan = c.plan; const field = plan.field;
  const wet = field === undefined || !plan.water.some((w) => !roundBody(w)) ? null : (x: number, z: number, d: number): boolean => {
    for (const [ox, oz] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]] as const) {
      const col = Math.round((x + ox - field.originX) / field.step); const row = Math.round((z + oz - field.originZ) / field.step);
      if (col >= 0 && row >= 0 && col < field.res && row < field.res && field.water[row * field.res + col] === 1) return true;
    }
    return false;
  };
  refWets.set(c, wet);
  return wet;
}

/** The pre-index `splatAt`, frozen (only `toLocal` inlined; it is private to layout.ts). */
function splatAtReference(c: SplatContext, x: number, z: number, out: SplatFields): SplatFields {
  const plan = c.plan;
  const n1 = valueNoise(x * 0.9, z * 0.9, c.salt);
  const n2 = valueNoise(x * 0.23, z * 0.23, c.salt + 7);
  out.plaza = plan.plaza ? plan.plaza.r - Math.hypot(x - plan.plaza.x, z - plan.plaza.z) : -1e3;
  for (const p of c.pockets) {
    const dx = x - p.x; const dz = z - p.z;
    const cs = Math.cos(p.yaw); const sn = Math.sin(p.yaw);
    const lx = cs * dx - sn * dz; const lz = sn * dx + cs * dz;
    const inside = Math.min(p.hw - Math.abs(lx), p.hd - Math.abs(lz));
    if (inside > out.plaza) out.plaza = inside;
  }
  let rd = Infinity; let pathRd = Infinity;
  for (const r of c.roads) {
    const d = distToPolyline(r.points, x, z) - r.width / 2;
    if (r.kind === 'path') { if (d < pathRd) pathRd = d; } else if (d < rd) rd = d;
  }
  out.path = Math.max(-rd + n1 * 0.22, -pathRd + n1 * 0.15 - 0.05);
  const n3 = valueNoise(x * 0.35, z * 0.35, c.salt + 13);
  let detail = -rd + 0.02 + n1 * 0.22 + n3 * 0.6;
  detail = Math.max(detail, -pathRd + 0.35 + n1 * 0.2);
  for (const b of c.buildings) {
    const fd = footprintDistance(b, x, z);
    if (fd < 3) detail = Math.max(detail, 0.3 - fd + n1 * 0.25 + n3 * 0.45);
  }
  for (const w of plan.water) {
    if (!roundBody(w)) continue;
    const d = Math.hypot(x - w.cx, z - w.cz);
    if (d < w.r + 3) detail = Math.max(detail, w.r + 0.7 - d + n1 * 0.35 + n3 * 0.3);
  }
  const wet = wetReference(c);
  if (wet !== null && wet(x, z, 2.2)) detail = Math.max(detail, (wet(x, z, 1.1) ? 0.55 : 0.12) + n1 * 0.35 + n3 * 0.3);
  for (const e of plan.grassPatches) if (inEllipse(e, x, z, 1.2)) detail = Math.max(detail, -0.2);
  detail = Math.max(detail, (n2 - 0.86) * 3 + n1 * 0.2);
  const edge = Math.max(Math.abs(x), Math.abs(z)) - (plan.half - FIELD_MARGIN);
  if (edge > 2) detail = Math.max(detail, (edge - 6) * 0.25 + n2 * 0.8);
  out.detail = detail;
  return out;
}

const FULL = process.env.EWA_SPLAT_FULL === '1';

describe('splatAt index', () => {
  it(`is bit-identical to the plain loops at ${FULL ? 'every' : 'every 3rd'} terrain sample of every zone (+ points off the grid)`, () => {
    const a: SplatFields = { plaza: 0, path: 0, detail: 0 }; const b: SplatFields = { plaza: 0, path: 0, detail: 0 };
    const stride = FULL ? 1 : 3;
    let samples = 0; let tRef = 0; let tNew = 0;
    const rows: string[] = [];
    for (const zd of allZones()) {
      const spec = realSpec(zd.id as ZoneId);
      const ctx = createSplatContext(layoutOf(spec), spec.buildings, spec.seed, spec.interiors);
      const h = spec.heightfield;
      const pts: number[] = [];
      for (let r = 0; r < h.res; r += stride) for (let c = 0; c < h.res; c += stride) pts.push(h.originX + c * step(h), h.originZ + r * step(h));
      // skirt / neighbour samples, cell borders and the grid's outside (the full-loop fallback)
      const far = ctx.plan.half + 90;
      for (let i = 0; i <= 400; i++) { const t = -far + (2 * far * i) / 400; pts.push(t, t * 0.37, t * -0.81, t, 4 * Math.round(t / 4), t, t, 4 * Math.round(t / 4)); }
      const t0 = performance.now();
      const ref: number[] = [];
      for (let i = 0; i < pts.length; i += 2) { splatAtReference(ctx, pts[i]!, pts[i + 1]!, a); ref.push(a.plaza, a.path, a.detail); }
      const t1 = performance.now();
      const got: number[] = [];
      for (let i = 0; i < pts.length; i += 2) { splatAt(ctx, pts[i]!, pts[i + 1]!, b); got.push(b.plaza, b.path, b.detail); }
      const t2 = performance.now();
      tRef += t1 - t0; tNew += t2 - t1; samples += pts.length / 2;
      rows.push(`${zd.id} ${h.res}² ref ${(t1 - t0).toFixed(0)} ms new ${(t2 - t1).toFixed(0)} ms`);
      for (let i = 0; i < ref.length; i++) {
        if (!Object.is(ref[i], got[i])) expect.fail(`${zd.id} @ (${pts[(i / 3 | 0) * 2]}, ${pts[(i / 3 | 0) * 2 + 1]}) field ${i % 3}: ${ref[i]} vs ${got[i]}`);
      }
    }
    if (process.env.EWA_SPLAT_TIMING === '1') console.log(`${rows.join('\n')}\n${allZones().length} zones, ${samples} samples: ref ${tRef.toFixed(0)} ms, new ${tNew.toFixed(0)} ms`);
    expect(samples).toBeGreaterThan(0);
  }, 300_000);
});

function step(h: { readonly step: number }): number { return h.step; }
