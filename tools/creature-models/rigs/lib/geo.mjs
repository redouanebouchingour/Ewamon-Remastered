// Part tests for `assign(centroid, rgb)`, written in the scad's own terms: a triangle belongs to a part when it lies on
// that part's primitive (lib.scad's ell / blob / limb / chain / petal), so a rig file copies the scad's numbers instead
// of inventing boxes. Distances are normalised: 1 = on the primitive's surface (a visible triangle of a unioned part
// sits at about 1; < 1 is inside, which only hidden geometry would be).

import { DEG } from './anim.mjs';

/** Same colour within `tol` per channel (sRGB 0..1, as the scad writes them). */
export const near = (rgb, c, tol = 0.04) => Math.abs(rgb[0] - c[0]) < tol && Math.abs(rgb[1] - c[1]) < tol && Math.abs(rgb[2] - c[2]) < tol;
export const isAny = (rgb, cols, tol) => cols.some((c) => near(rgb, c, tol));
/** The side a point is on: L = +X (the creature's own left). */
export const side = (c) => (c[0] >= 0 ? 'L' : 'R');
/** Folds a point onto the +X side (mirror_x() parts are written once, for the left). */
export const fold = (c) => [Math.abs(c[0]), c[1], c[2]];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Normalised distance from an ellipsoid ell(r, p): 1 on its surface. */
export const ellD = (c, r, p = [0, 0, 0]) => Math.hypot((c[0] - p[0]) / r[0], (c[1] - p[1]) / r[1], (c[2] - p[2]) / r[2]);

/** limb(p1, p2, r1, r2): the segment parameter t (0..1) of c's foot point and the normalised distance (1 = surface). */
export function capsule(c, p1, p2, r1, r2 = r1) {
  const d = sub(p2, p1);
  const l2 = dot(d, d) || 1e-9;
  const t = Math.min(1, Math.max(0, dot(sub(c, p1), d) / l2));
  const f = [p1[0] + d[0] * t, p1[1] + d[1] * t, p1[2] + d[2] * t];
  return { t, d: Math.hypot(...sub(c, f)) / (r1 + (r2 - r1) * t) };
}
export const capD = (c, p1, p2, r1, r2) => capsule(c, p1, p2, r1, r2).d;

/** chain(pts, rs): the nearest link (i = 0 for pts[0] -> pts[1]), its t and the normalised distance. */
export function chainHit(c, pts, rs) {
  let best = { i: 0, t: 0, d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const h = capsule(c, pts[i], pts[i + 1], rs[i], rs[i + 1]);
    if (h.d < best.d) best = { i, t: h.t, d: h.d };
  }
  return best;
}

/** blob(parts): the hull of ellipsoids, approximated by the nearest one (good enough away from the hull's waist). */
export const blobD = (c, parts) => Math.min(...parts.map(([r, p]) => ellD(c, r, p)));

/** OpenSCAD rotate([rx, ry, rz]) applied to a vector (x first, then y, then z, about the fixed axes). */
export function rot([rx, ry, rz], v) {
  let [x, y, z] = v;
  const cx = Math.cos(rx * DEG); const sx = Math.sin(rx * DEG);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  const cy = Math.cos(ry * DEG); const sy = Math.sin(ry * DEG);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cz = Math.cos(rz * DEG); const sz = Math.sin(rz * DEG);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return [x, y, z];
}
/** The inverse of rot(r): undoes z, then y, then x. */
export function unrot([rx, ry, rz], v) {
  let [x, y, z] = v;
  const cz = Math.cos(-rz * DEG); const sz = Math.sin(-rz * DEG);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cy = Math.cos(-ry * DEG); const sy = Math.sin(-ry * DEG);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(-rx * DEG); const sx = Math.sin(-rx * DEG);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
}

/**
 * A scad sub-frame `translate(t) rotate(r) scale(s) { … }`: `world(p)` maps a point written inside it to world
 * coordinates, `local(c)` maps a world point back (for tests against the numbers inside the block).
 */
export function subFrame(t = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const S = Array.isArray(s) ? s : [s, s, s];
  return {
    world: (p) => { const q = rot(r, [p[0] * S[0], p[1] * S[1], p[2] * S[2]]); return [q[0] + t[0], q[1] + t[1], q[2] + t[2]]; },
    local: (c) => { const q = unrot(r, sub(c, t)); return [q[0] / S[0], q[1] / S[1], q[2] / S[2]]; },
    scale: S,
    rot: r,
  };
}

/** petal(r, p, rot): normalised distance from a rotated ellipsoid. */
export const petalD = (c, r, p, rr = [0, 0, 0]) => ellD(unrot(rr, sub(c, p)), r);

/** Signed distance from [x, z] to a polygon outline [[x, z], …]: negative inside. */
export function polyD([x, z], pts) {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, az] = pts[j];
    const [bx, bz] = pts[i];
    if ((bz > z) !== (az > z) && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const dx = bx - ax; const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return inside ? -best : best;
}

/**
 * lib.scad plate(pts, t): an [x, z] outline extruded `t` thick along Y, centred on y = 0. Pass the point in the
 * plate's own frame (`subFrame(…).local(c)` for a plate inside translate / rotate). 1 = on its surface, sized by t.
 */
export function plateD(c, pts, t = 1) {
  const out = Math.max(polyD([c[0], c[2]], pts), Math.abs(c[1]) - t / 2);
  return 1 + out / Math.max(t / 2, 0.3);
}

/**
 * lib.scad slab(pts, depth, inset): a pillow of an [x, z] outline, about 0.05 × depth thick at the outline, 0.6 ×
 * depth at `inset × 0.45` in and the full depth at `inset` in. Point in the slab's own frame; 1 = on its surface.
 */
export function slabD(c, pts, depth, inset = 1.5) {
  const e = -polyD([c[0], c[2]], pts);   // how far inside the outline
  const half = e <= 0 ? 0.05 * depth
    : e < 0.45 * inset ? (0.05 + ((0.3 - 0.05) * e) / (0.45 * inset)) * depth
      : e < inset ? (0.3 + ((0.5 - 0.3) * (e - 0.45 * inset)) / (0.55 * inset)) * depth : 0.5 * depth;
  const out = Math.max(-e, Math.abs(c[1]) - half);
  return 1 + out / Math.max(depth / 2, 0.3);
}

/**
 * Picks the part whose primitive c lies closest to (normalised distance), among `parts` = [[name, d(c)], …]; null
 * when none is within `max`. For parts of one colour that touch (a head on a torso, a leg on a haunch).
 */
export function closest(parts, max = Infinity) {
  let best = null;
  let bd = max;
  for (const [name, d] of parts) if (d < bd) { bd = d; best = name; }
  return best;
}
