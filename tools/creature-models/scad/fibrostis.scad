// Fibrostis: a small shaggy grey creature made of fibres, like a walking haystack or an old sheepdog. A big round head
// grown into a round body (one pear, no neck), everything covered in long soft grey-white strands hanging down in
// layers; on the head they radiate from a point between and just under the eyes (up over the crown, out to the
// sides and back, down over the chest), then fall with gravity. Two calm round pale eyes with big dark pupils peer out
// of the pale face fur. Hairy arms hang at its sides ending in strand fingers, short furry legs on stubby feet with
// pale toes, and wisps of grey smoke curl round it.
//
// Checklist (front sheet, units = 40 tall):
//   head      sheet x -11..8, z 19..38 (flyaway strands to x -13 on the left, to z 39 on top). The strands radiate
//             from the face centre at sheet (-6.2, 24.4); the face fur round it is the palest grey.
//   eyes      near (+X) at sheet (-2.1, 26.2), 3.7 wide x 3.5 tall, round; far at (-9.1, 26.2), seen narrow. Dark ink
//             rim, pale eye, big dark pupil, white shine top left. Calm, no lids.
//   body      sheet x -8..8.5, z 4..22, strands hanging and parting down the chest from under the face.
//   arms      near: shoulder (8.5, 19) to the hand (11, 9), strand fingers to z 7; far (-8.5, 18) to (-10.5, 8).
//   legs      near x 1..9.5, far x -9..-1.5, z 0..9: short furry pillars, stubby feet, three pale toe tufts each.
//   colours   strands [0.45 .. 0.82] grey with a lilac cast, the gaps between them darker; the face and the head's
//             front are the palest, the legs the darkest.
//   smoke     pale grey wisps: left C-curl x -16..-13 z 10..23, right S-curl x 11..17 z 6..25, curls off the crown
//             at x 2..10 z 32..38 and x -5..0 z 37..39.
//   back      the same strands all over, flowing back and down, flyaway tips sticking out behind the head.
//
// Rigging: every strand group has its own exact shades (head, body, arms, legs), so the rig tells them apart by colour.
include <lib.scad>

// shades per part: dark, mid, mid-light, light, pale (the rig keys on these exact values)
SH_HEAD = [[0.45, 0.42, 0.43], [0.55, 0.53, 0.52], [0.64, 0.62, 0.6], [0.72, 0.71, 0.68], [0.8, 0.8, 0.76, NOGLOW]];
SH_BODY = [[0.465, 0.435, 0.445], [0.565, 0.545, 0.535], [0.655, 0.635, 0.615], [0.735, 0.725, 0.695], [0.815, 0.815, 0.775, NOGLOW]];
SH_ARM = [[0.48, 0.45, 0.46], [0.58, 0.56, 0.55], [0.67, 0.65, 0.63], [0.75, 0.74, 0.71], [0.83, 0.83, 0.79, NOGLOW]];
SH_LEG = [[0.43, 0.405, 0.415], [0.535, 0.515, 0.505], [0.625, 0.605, 0.585], [0.705, 0.695, 0.665], [0.785, 0.785, 0.745, NOGLOW]];
// the darker under-fur showing between the strands
CORE = [0.52, 0.49, 0.5];
COREA = [0.54, 0.51, 0.52];
CORELG = [0.47, 0.44, 0.45];
FACE = [0.78, 0.78, 0.73, NOGLOW];   // the pale face fur round the eyes
INK = [0.1, 0.08, 0.1];
SCLERA = [0.8, 0.82, 0.78, NOGLOW];
IRIS = [0.66, 0.66, 0.7];
PUPIL = [0.17, 0.15, 0.18];
SMOKE = [0.87, 0.87, 0.83, NOGLOW];

function nz(v) = v / norm(v);
function rx(a, v) = [v[0], v[1] * cos(a) - v[2] * sin(a), v[1] * sin(a) + v[2] * cos(a)];
function rz(a, v) = [v[0] * cos(a) - v[1] * sin(a), v[0] * sin(a) + v[1] * cos(a), v[2]];
function mul(a, b) = [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
function dv(a, b) = [a[0] / b[0], a[1] / b[1], a[2] / b[2]];
function cl(v, a, b) = min(b, max(a, v));

// One strand: a long thin tapered blade from its root p0 to its tip p1, lying on a surface whose outward normal is
// `nrm` and arched `bulge` off the straight line (so it hugs a round body), widest a third of the way down. A
// ten-point polyhedron (16 triangles), so the coat can have hundreds of them.
module strand(p0, p1, nrm, w, c, th = 0.35, bulge = 0.5) {
  d = p1 - p0;
  L = norm(d);
  u = d / L;
  n = nz(nrm - (nrm * u) * u);
  s = cross(n, u);
  function P(x, y, z) = p0 + x * u + y * s + z * n;
  b1 = bulge * 0.84;
  b2 = bulge * 0.91;
  pts = [P(-0.04 * L, 0, bulge * 0.1),
         P(0.3 * L, -w / 2, b1), P(0.3 * L, 0, b1 + th), P(0.3 * L, w / 2, b1), P(0.3 * L, 0, b1 - th),
         P(0.65 * L, -w * 0.3, b2), P(0.65 * L, 0, b2 + th * 0.7), P(0.65 * L, w * 0.3, b2), P(0.65 * L, 0, b2 - th * 0.7),
         P(L, 0, 0)];
  color(c) polyhedron(pts, concat(
    [for (i = [0 : 3]) [0, 1 + (i + 1) % 4, 1 + i]],
    [for (i = [0 : 3]) each [[1 + i, 1 + (i + 1) % 4, 5 + (i + 1) % 4], [1 + i, 5 + (i + 1) % 4, 5 + i]]],
    [for (i = [0 : 3]) [9, 5 + i, 5 + (i + 1) % 4]]));
}

// One draped strand of hair: a thin flat ribbon laid along a surface path, qs / ns the path's points and outward
// normals at f = 0, 0.25, 0.5, 0.78, 1 (root to tip). The root is sunk in the surface; the ribbon floats just over
// it (`up` more for every other strand, so neighbours do not cut into each other) and lifts away towards the tip
// (`lift` at the tip): wide at the root, tapering to a point. Ten points, 16 triangles.
DRAPE_F = [0, 0.3, 0.68, 1];
DRAPE_W = [0.75, 0.88, 0.5];
module drape(qs, ns, w, c, lift, th = 0.2, up = 0) {
  m = len(DRAPE_F) - 1;
  function h(j) = j == 0 ? -0.3 : 0.12 + up + (lift + 0.4) * DRAPE_F[j];
  function U(j) = nz(qs[min(m, j + 1)] - qs[max(0, j - 1)]);
  function S(j) = nz(cross(ns[j], U(j)));
  ring = [for (j = [0 : m - 1]) let(o = qs[j] + h(j) * ns[j], hw = w * DRAPE_W[j] / 2) each [o - S(j) * hw, o + th * ns[j], o + S(j) * hw]];
  pts = concat(ring, [qs[m] + h(m) * ns[m]]);
  t = 3 * m;
  l = 3 * (m - 1);
  color(c) polyhedron(pts, [for (f = concat(
    [[0, 1, 2]],
    [for (j = [0 : m - 2], q = [0 : 2]) let(a = 3 * j + q, b = 3 * j + (q + 1) % 3)
      each [[a, a + 3, b + 3], [a, b + 3, b]]],
    [[t, l + 1, l], [t, l + 2, l + 1], [t, l, l + 2]])) [f[2], f[1], f[0]]]);
}

// ---------------- the pear: head and body in one ----------------
HC = [0, -1.8, 28.3];
HR = [9.4, 8.6, 9.2];
BC = [0, 0.5, 13.5];
BR = [8.6, 7.6, 9];
// the surface: the head ellipsoid above HC, the body's below BC, elliptic sections blending between
function sec(z) = let(t = cl((z - BC[2]) / (HC[2] - BC[2]), 0, 1)) [BR[0] + (HR[0] - BR[0]) * t, BR[1] + (HR[1] - BR[1]) * t, BC[1] + (HC[1] - BC[1]) * t];
function pearProj(p) =
  p[2] >= HC[2] ? HC + mul(HR, nz(dv(p - HC, HR))) :
  p[2] <= BC[2] ? BC + mul(BR, nz(dv(p - BC, BR))) :
  let(s = sec(p[2]), a = atan2((p[1] - s[2]) / s[1], p[0] / s[0])) [s[0] * cos(a), s[2] + s[1] * sin(a), p[2]];
function pearN(q) =
  q[2] >= HC[2] ? nz(dv(q - HC, mul(HR, HR))) :
  q[2] <= BC[2] ? nz(dv(q - BC, mul(BR, BR))) :
  let(s = sec(q[2])) nz([q[0] / (s[0] * s[0]), (q[1] - s[2]) / (s[1] * s[1]), -0.06]);
function pearAt(az, z) = pearProj([cos(az) * 30, sec(z)[2] + sin(az) * 30, z]);

color(CORE) hull() { translate(HC) scale(HR) sphere(1, $fn = 22); translate(BC) scale(BR) sphere(1, $fn = 22); }

// a strand from the root p0 (on the pear) along `dir` for L, its tip laid back on the pear and lifted `lift` off it
module flow(p0, dir, L, w, c, lift, up = 0) {
  t = pearProj(p0 + L * dir);
  qs = [for (f = DRAPE_F) pearProj(p0 + f * (t - p0))];
  drape(qs, [for (q = qs) pearN(q)], w, c, lift, up = up);
}

// ---------------- head ----------------
// The head's strands radiate from the face centre: a pole tipped HTX below the front and turned HYAW. Directions are
// (th = angle from the pole, ps = angle round it: 0 towards +X, 90 up).
HTX = 21;
HYAW = -5;
function hd(th, ps) = rz(HYAW, rx(HTX, [sin(th) * cos(ps), -cos(th), sin(th) * sin(ps)]));
function hP(th, ps, k = 1) = HC + k * mul(HR, hd(th, ps));
function hN(th, ps) = let(d = hd(th, ps)) nz([d[0] / HR[0], d[1] / HR[1], d[2] / HR[2]]);

// the eyes, in the pole frame
EYE_TH = 29;
EYE_PS = 22;
EYE_SIZE = 2.2;
EYES = [[EYE_TH, EYE_PS], [EYE_TH, 180 - EYE_PS]];
function eyeAt(e) = hP(e[0], e[1], 0.95);
function eyeYaw(e) = let(n = hN(e[0], e[1])) atan2(n[0], -n[1]);
function nearEye(th, ps, r = 18) = min([for (e = EYES) acos(min(1, hd(th, ps) * hd(e[0], e[1])))]) < r;
echo(eyeL = eyeAt(EYES[0]), yawL = eyeYaw(EYES[0]));

// a head strand rooted at (th, ps): out from the face, bending down with gravity the further back it grows (k)
module hStrand(th, ps, L, w, c, lift, up = 0) {
  p0 = pearProj(hP(th, ps));
  n = pearN(p0);
  tr = nz(pearProj(hP(th + 2, ps)) - p0);
  g0 = [0, 0, -1] + n[2] * n;
  k = cl((th - 30) / 100, 0, 0.7);
  dir = norm(g0) < 0.3 ? tr : nz(tr * (1 - k) + nz(g0) * k);
  flow(p0, dir, L, w, c, lift, up);
}

// rows: [th, count, length, width, lift, shade indices]
HROWS = [
  [3, 8, 4.5, 1.8, 0.1, [4, 4, 3]],
  [15, 14, 6.5, 2.4, 0.2, [4, 3, 4, 4, 4]],
  [32, 20, 8, 2.6, 0.35, [3, 4, 4, 2, 4, 3]],
  [52, 24, 8.5, 2.8, 0.5, [3, 2, 4, 1, 3, 4]],
  [74, 26, 9, 2.8, 0.8, [2, 3, 4, 1, 3, 0]],
  [98, 26, 9, 2.8, 1.0, [2, 3, 1, 4, 2, 0, 3]],
  [122, 22, 8.5, 2.8, 1.1, [2, 1, 3, 0, 2, 4]],
  [146, 14, 7.5, 2.8, 1.0, [1, 2, 3, 0, 2]],
  [168, 6, 6, 2.6, 0.9, [2, 3, 1]],
];
for (k = [0 : len(HROWS) - 1]) let(row = HROWS[k], n = row[1])
  for (i = [0 : n - 1]) let(ps = (i + (k % 2) * 0.5) * 360 / n - 180, th = row[0], p = hP(th, ps))
    // no strand over an eye; low on the sides and back the body's rows take over (the face keeps its beard)
    if (!nearEye(th, ps) && !nearEye(th + 12, ps, 13) && (p[2] > 21 || (ps < -20 && ps > -160 && th < 60)))
      hStrand(th, ps, row[2], row[3], SH_HEAD[row[5][i % len(row[5])]], row[4], (i % 2) * 0.28);
// flyaway strands sticking out of the silhouette: [th, ps, length, lift]
for (f = [[88, 172, 9, 3.2], [104, 188, 9, 3.4], [70, 120, 8, 2.8], [92, 96, 8.5, 3], [118, 30, 8, 2.8], [140, 160, 7, 3]])
  hStrand(f[0], f[1], f[2], 1.6, SH_HEAD[f[0] % 2 == 0 ? 3 : 2], f[3]);

// the pale face fur round the eyes
color(FACE) intersection() { translate(HC) scale(HR + [0.12, 0.12, 0.12]) sphere(1, $fn = 30); translate(hP(14, 90)) sphere(5.6, $fn = 20); }

// the eyes: calm, round, set into the face fur with a thin dark rim
for (e = EYES) let(p = eyeAt(e), yw = eyeYaw(e)) {
  color(INK) translate(p) rotate([0, 0, yw]) translate([0, 0.15, 0]) scale([1.12, 0.44, 1.18] * EYE_SIZE) sphere(1, $fn = 20);
  eye(p, EYE_SIZE, iris = IRIS, sclera = SCLERA, pupil = PUPIL, yaw = yw, flat = 0.42, shine = true);
}

// ---------------- body ----------------
// rows of strands hanging down the pear: [z, count, length, width, lift, shade indices]; in front, under the face,
// the beard covers the top rows, and the strands part away from the chest's middle
BROWS = [
  [22, 24, 7.5, 2.8, 0.6, [2, 1, 3, 0, 2, 4]],
  [16.5, 24, 7.5, 2.8, 0.7, [3, 2, 0, 1, 2, 4, 1]],
  [11, 22, 7, 2.8, 0.9, [1, 2, 4, 3, 2, 0]],
  [6.5, 16, 5, 2.8, 1.2, [1, 0, 2, 1, 3]],
];
for (k = [0 : len(BROWS) - 1]) let(row = BROWS[k], n = row[1])
  for (i = [0 : n - 1]) let(az = (i + (k % 2) * 0.5) * 360 / n - 90, z = row[0], p0 = pearAt(az, z))
    // not under the face (the beard is there) nor behind the arms
    if (!(z > 20 && abs(az + 90) < 42) && !(z > 9 && abs(cos(az)) > 0.93))
      let(np = pearN(p0), g0 = [0, 0, -1] + np[2] * np, side = [-sin(az), cos(az), 0] * cos(az) * 0.25)
        flow(p0, nz(nz(g0) + side), row[2], row[3], SH_BODY[row[5][i % len(row[5])]], row[4], (i % 2) * 0.28);

// ---------------- arms ----------------
// strands round a capsule A..B (radius r): rows [t, count, length, width, lift, shade indices], hanging towards B
function capFoot(A, B, p) = A + cl((p - A) * (B - A) / ((B - A) * (B - A)), 0, 1) * (B - A);
function capProj(A, B, r, p) = let(f = capFoot(A, B, p)) f + r * nz(p - f);
function capN(A, B, q) = nz(q - capFoot(A, B, q));
module coatLimb(A, B, r, rows, cols, inner = -1) {
  ax = nz(B - A);
  e1 = nz(cross(ax, [0, 1, 0]));
  e2 = cross(ax, e1);
  for (k = [0 : len(rows) - 1], i = [0 : rows[k][1] - 1])
    let(row = rows[k], ph = (i + (k % 2) * 0.5) * 360 / row[1], rad = cos(ph) * e1 + sin(ph) * e2,
        p0 = A + row[0] * (B - A) + r * 0.95 * rad, p1 = p0 + row[2] * ax + row[4] * rad)
      // no strands on the inner side (against the body), where they only cut into the body's coat
      if (cos(ph) > inner) let(qs = [for (f = DRAPE_F) capProj(A, B, r, p0 + f * (p1 - p0))])
        drape(qs, [for (q = qs) capN(A, B, q)], row[3], cols[row[5][(i + k) % len(row[5])]], row[4], up = (i % 2) * 0.28);
}
SHO = [9.4, -0.5, 19.5];
HAND = [12.4, -1.2, 9.5];
mirror_x() {
  limb(SHO, HAND, 2.7, 2.5, COREA);
  coatLimb(SHO + [0, 0, 1.5], HAND, 2.6, [[0, 9, 5.5, 2.7, 0.7, [2, 3, 1, 4]], [0.3, 9, 5.5, 2.7, 0.9, [1, 2, 0, 3]],
                                         [0.6, 9, 5.2, 2.7, 1.1, [3, 1, 2, 0, 4]]], SH_ARM, -0.6);
  // the strand fingers hanging off the hand
  for (k = [0 : 3]) let(a = -55 + k * 37, d = [sin(a) * 0.9, -cos(a) * 0.9, 0])
    strand(HAND + [0, 0, -0.5] + d * 2, HAND + [d[0] * 2.4, d[1] * 2.6, -4.2 + abs(k - 1.5) * 0.5], [d[0], d[1], 0.1], 1.7,
           SH_ARM[[3, 1, 4, 2][k]], bulge = 0.4);
}

// ---------------- legs ----------------
HIP = [5.6, 0.5, 8.5];
ANK = [5.8, -0.5, 2.6];
FOOT = [5.8, -1.4, 1.5];
mirror_x() {
  limb(HIP, ANK, 3.1, 3.2, CORELG);
  color(SH_LEG[1]) translate(FOOT) scale([3.8, 4.4, 1.9]) sphere(1, $fn = 16);
  coatLimb(HIP + [0, 0, 1], ANK, 3.0, [[0, 8, 4.8, 2.8, 0.9, [1, 2, 0, 3, 1]], [0.5, 9, 4.6, 2.8, 1.3, [2, 0, 1, 3]]], SH_LEG, -0.75);
  // three stubby pale toes at the front of the foot
  for (k = [-1 : 1]) color(SH_LEG[k == 0 ? 4 : 3]) translate(FOOT + [k * 2.1, -3.5 + abs(k) * 0.6, -0.2]) rotate([0, 0, k * 14])
    scale([1.15, 1.7, 1.1]) sphere(1, $fn = 10);
}

// ---------------- smoke ----------------
// a soft flat ribbon of smoke along a centreline traced on the front sheet, `d` behind the picture plane, tapering
// from w0 to w1 and thinning at both ends
module ribbon(pts, w0, w1, d, t = 0.7) {
  n = len(pts);
  function wd(i) = (w0 + (w1 - w0) * i / (n - 1)) * (i == 0 || i == n - 1 ? 0.55 : 1);
  color(SMOKE) pp(d) rotate([90, 0, 0]) linear_extrude(height = t, center = true)
    for (i = [0 : n - 2]) hull() {
      translate(pts[i]) circle(d = wd(i), $fn = 10);
      translate(pts[i + 1]) circle(d = wd(i + 1), $fn = 10);
    }
}
ribbon([[-13, 10], [-15.2, 12.4], [-16, 15.5], [-15.7, 18.5], [-15.4, 20.8], [-14.3, 22.3], [-12.8, 22.6]], 2.2, 3.0, 1);
ribbon([[12.6, 6.6], [14.2, 9.2], [14.2, 11.6], [12.7, 13.6], [13.1, 15.8], [15.5, 17.4], [16.6, 20], [16, 22.6], [13.9, 24.6], [11.5, 25]], 2.0, 3.2, 3);
ribbon([[2.5, 35.8], [5, 37.3], [8.2, 37.1], [9.6, 35.1], [8.8, 33.1], [7.2, 32.5]], 2.2, 1.6, 1.5);
ribbon([[0.6, 38.2], [-1.8, 38.6], [-4.5, 37.3]], 1.8, 1.2, 0.5);
