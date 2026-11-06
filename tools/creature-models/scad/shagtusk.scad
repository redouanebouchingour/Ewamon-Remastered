// Shagtusk: a heavy woolly mammoth (sprite-match pass, 2026-11-04).
// Checklist (front sheet, 40 units tall):
// - body: a long shaggy bean, sheet x -5..21, z 7..34, highest over the shoulders (34) sloping to the rump (z 26);
//   its fur is drawn as overlapping downward-pointing locks in three browns, the outline ragged with lock tips.
// - snow: a pale icy sheet over the back (sheet x -4..15, z 23..36), its lower edge dripping in points, lowest over the
//   rump; a brown fur hole shows through it on the back (back sheet). Five ice crystal spikes down the spine, the
//   front one tallest (tips z 39.7, 37.6, 36, 33.3, 30.3).
// - frost: icy-blue painted patches with zigzag edges on the flanks round z 11..19 (front: sheet 2.6..9.8 and the
//   rump 14.6..19.7; back sheet: a band across both flanks).
// - head: big and low at the front (sheet x -17..-1, z 10..27) under a heaped snow cap (x -15..2.7, z 22..35) that
//   drips over the forehead; shaggy cheeks.
// - face: two big blue eyes (near 4.8 x 4.4 at sheet (-4.1, 19.1), far at (-12.8, 19.3)), an angry V brow, a dark
//   pupil and a white highlight; a short thick ridged trunk to z 7 (sheet x -12.5..-7); two tusks under the cheeks,
//   a short pale root and a big faceted blue ice crystal pointing forward, down and out (tips at sheet (-10.4, 6.8)
//   and (-20.8, 8.3)).
// - legs: four short thick shaggy pillars, three pale icy toenails each; a short tail with an ice crystal tip (back).
include <lib.scad>

furLt = [0.6, 0.41, 0.22];
fur = [0.48, 0.34, 0.2];
furDk = [0.37, 0.27, 0.17];
furDeep = [0.26, 0.19, 0.12];
face = [0.56, 0.39, 0.21];
snow = [0.75, 0.91, 0.92, NOGLOW];
frost = [0.56, 0.77, 0.83, NOGLOW];
ice = [0.5, 0.82, 0.93, NOGLOW];
iceDk = [0.3, 0.62, 0.84, NOGLOW];
nail = [0.66, 0.82, 0.85, NOGLOW];
root = [0.86, 0.94, 0.94, NOGLOW];

// Deterministic jitter in [0, 1).
function rnd(i) = let(x = sin(i * 127.1 + 31.7) * 4375.85) x - floor(x);
function eP(c, r, az, el) = c + [r[0] * cos(el) * sin(az), -r[1] * cos(el) * cos(az), r[2] * sin(el)];
function eN(r, az, el) = let(n = [cos(el) * sin(az) / r[0], -cos(el) * cos(az) / r[1], sin(el) / r[2]]) n / norm(n);
function inE(p, c, r, f = 1) = pow((p[0] - c[0]) / r[0], 2) + pow((p[1] - c[1]) / r[1], 2) + pow((p[2] - c[2]) / r[2], 2) < f * f;
function inAny(p, regs, f = 1) = len([for (s = regs) if (inE(p, s[0], s[1], f)) 1]) > 0;

// A fur lock: a flat teardrop lying on the surface at p (normal n), pointing down the surface (along g projected),
// `len` long, `w` wide, `t` thick. Rows of them overlap like shingles; their tips make the ragged outline.
function lockFrame(n, g) = let(gd = g / norm(g), d0 = gd - n * (gd * n), d = norm(d0) < 0.15 ? [0, 1, 0] : d0 / norm(d0),
                               u = cross(d, n)) [u / norm(u), d, n];
// The tip bends back towards the surface (R: the surface's rough radius) so the lock hugs a round body.
module lock(p, n, g, len, w, t, c, R = 11) let(F = lockFrame(n, g))
  color(c) multmatrix([[F[0][0], F[1][0], F[2][0], p[0]], [F[0][1], F[1][1], F[2][1], p[1]],
                       [F[0][2], F[1][2], F[2][2], p[2]], [0, 0, 0, 1]]) hull() {
    translate([0, 0, -t * 0.3]) scale([w, w * 0.8, t]) sphere(1, $fn = 8);
    translate([0, len * 0.5, t * 0.15 - len * len / (8 * R)]) scale([w * 0.75, 0.6, t * 0.8]) sphere(1, $fn = 6);
    translate([0, len, t * 0.35 - len * len / (2 * R)]) scale([0.5, 0.5, 0.4]) sphere(1, $fn = 4);
  }
// A faceted ice crystal from a to b, widest (r) a third of the way.
module crystal(a, b, r, c = ice, c2 = iceDk) {
  color(c) hull() {
    translate(a) sphere(r * 0.65, $fn = 6);
    translate(a + (b - a) * 0.35) rotate([0, 0, 30]) sphere(r, $fn = 6);
    translate(b) sphere(0.12, $fn = 4);
  }
  // a darker facet down one side
  color(c2) hull() {
    translate(a + (b - a) * 0.35 + [0, 0, -r * 0.35]) sphere(r * 0.72, $fn = 4);
    translate(b + [0, 0, -0.05]) sphere(0.1, $fn = 4);
  }
}

// ---- Body: overlapping masses along the spine (shoulder high, rump big and low), dark fur under the locks.
B = [[[0, -3, 20.5], [12, 10, 12]], [[0, 5, 19], [12, 9, 11]], [[0, 12, 15.5], [12, 11, 10]]];
H = [[0, -12, 21.3], [11, 8, 10]];
M = [[0, -16, 15], [6, 4.5, 5]];
module bodyShape(g = 0) for (e = B) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 26);
module bodyHull(g = 0) hull() for (e = B) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 26);
color(furDk) bodyShape();

// The snow line: snow above it, fur below; lower towards the rump.
function snowZ(y) = max(22.5, 28.2 - 0.55 * y);
FROST = [[[11, -5, 15], [6, 6.5, 5.5]], [[10.5, 14, 14], [6, 6, 4.5]], [[-10.5, -2, 14.5], [6, 7.5, 5]],
         [[-10, 12, 14.5], [6, 6, 4.5]], [[10.5, -4.5, 24.5], [3.5, 2.5, 2.5]]];

// Locks over one body mass: rings of shingled locks, skipping the parts buried in the other masses and the head and
// the parts under the snow sheet; just below the snow line they turn to snow drips, in the frost patches to frost.
module furOver(i, els, seed) let(c = B[i][0], r = B[i][1])
  for (ei = [0 : len(els) - 1]) let(el0 = els[ei], m = max(6, round(15 * cos(el0))))
    for (k = [0 : m - 1]) let(id = seed + ei * 37 + k, az = k * 360 / m + ei * 13 + rnd(id) * 8,
                              el = el0 + (rnd(id + 5) - 0.5) * 6, p = eP(c, r, az, el), n = eN(r, az, el),
                              sz = snowZ(p[1]), drip = p[2] > sz - 2.8 && rnd(id + 17) < 0.7,
                              fr = inAny(p, FROST))
      if (p[2] < sz + 0.3 && !inAny(p, [for (j = [0 : 2]) if (j != i) B[j]], 0.96) && !inE(p, H[0], H[1], 1.1))
        lock(p, n, [0, 0.3, -1], (5.2 + rnd(id + 9) * 1.4) * (drip ? 0.8 + rnd(id + 21) * 0.6 : 1) * (el0 < -30 ? 1.2 : 1),
             2.8 + rnd(id + 3) * 0.6, 0.7, drip ? snow : fr ? frost : (rnd(id + 7) < 0.55 ? fur : furLt));
furOver(0, [-36, -16, 4, 23, 40], 0);
furOver(1, [-36, -16, 4, 23, 40], 300);
furOver(2, [-36, -16, 4, 23, 40, 56], 600);

// Frost painted under the frost locks, so the patches read solid between them.
color(frost) intersection() { bodyShape(0.25); union() for (f = FROST) translate(f[0]) scale(f[1] * 0.85) sphere(1, $fn = 12); }

// Snow sheet over the back (lumpy), a fur hole showing through it, and the ice spikes down the spine.
module aboveSnow() for (y = [-14 : 4 : 26]) hull() {
  translate([0, y, snowZ(y) + 10]) cube([30, 0.01, 20], center = true);
  translate([0, y + 4, snowZ(y + 4) + 10]) cube([30, 0.01, 20], center = true);
}
HOLE = [[2.4, 9, 29.6], [2.6, 3.2, 3]];
color(snow) difference() {
  intersection() { bodyHull(0.9); aboveSnow(); }
  translate(HOLE[0]) scale(HOLE[1]) sphere(1, $fn = 10);
}
color(fur) intersection() { bodyHull(0.7); translate(HOLE[0]) scale(HOLE[1] + [0.1, 0.1, 0.1]) sphere(1, $fn = 10); }
for (s = [[-3, 32.2, 7.2], [4, 30.6, 6.2], [10, 28.4, 5.2], [16, 25.4, 4.4], [21, 22.2, 3.6]])
  translate([0, s[0], s[1]]) rotate([18, 0, 0]) {
    color(ice) cylinder(h = s[2], r1 = s[2] * 0.42, r2 = 0.1, $fn = 5);
    color(iceDk) rotate([0, 0, 36]) cylinder(h = s[2] * 0.9, r1 = s[2] * 0.36, r2 = 0.08, $fn = 3);
  }

// ---- Legs: short thick shaggy pillars, two rings of locks down to the foot, three pale icy toenails at the front.
LEGS = [[7.5, -7.5], [-7.5, -7.5], [7.5, 12], [-7.5, 12]];
for (q = LEGS) {
  limb([q[0], q[1], 10], [q[0], q[1], 4.4], 4, 4.2, fur);
  color(furDk) translate([q[0], q[1], 2.2]) scale([4.4, 4.4, 2.2]) sphere(1, $fn = 16);
  for (ring = [0 : 1]) for (a = [0 : 60 : 359]) let(id = 900 + a + q[1] + q[0] + ring * 7, b = a + 30 * ring,
                                                    n = [sin(b), -cos(b), 0])
    lock([q[0], q[1], 9.2 - ring * 3.2] + n * 4.1, n, [0, 0, -1], 3.6, 2.5, 0.65, rnd(id) < 0.5 ? fur : furLt, 30);
  for (a = [-38, 0, 38]) color(nail) translate([q[0] + 3.9 * sin(a), q[1] - 3.9 * cos(a), 1.1]) rotate([0, 0, a])
    scale([1.2, 0.95, 1.1]) sphere(1, $fn = 8);
}
// Tail: a short furry stub, an ice crystal tip pointing back and down.
limb([0, 20, 19], [0, 25, 15.5], 1.7, 1.2, fur);
crystal([0, 25, 15.5], [0, 29, 11.4], 1.6);

// ---- Head: big and low at the front, a fuller muzzle under the eyes; light brown face, shaggy cheeks.
color(face) translate(H[0]) scale(H[1]) sphere(1, $fn = 30);
color(face) translate(M[0]) scale(M[1]) sphere(1, $fn = 22);
// Cheek and crown locks, the face front kept clean (azimuths within 52 deg of the front).
for (ei = [0 : 3]) let(el0 = [-22, -4, 14, 30][ei], m = 15)
  for (k = [0 : m - 1]) let(id = 1200 + ei * 37 + k, az = k * 360 / m + ei * 11 + rnd(id) * 8,
                            azf = abs(((az + 180) % 360) - 180), el = el0 + (rnd(id + 5) - 0.5) * 6,
                            p = eP(H[0], H[1], az, el), n = eN(H[1], az, el))
    if (azf > 52 && azf < 140 && p[2] < 26.6 && !inAny(p, B, 0.98))
      lock(p, n, [0, 0, -1], 4.2 + rnd(id + 9) * 1.4, 2.5 + rnd(id + 3) * 0.5, 0.85, rnd(id + 7) < 0.5 ? face : fur, 9);
// Snow cap: a lumpy heap on the crown leaning over the forehead, its rim dripping down the head.
color(snow) {
  hull() {
    intersection() {
      translate(H[0]) scale(H[1] + [1.1, 1.1, 1.1]) sphere(1, $fn = 26);
      translate([0, -11, 26 + 10]) cube([30, 30, 20], center = true);
    }
    for (l = [[-2.6, -14, 31, 4.4, 3.8, 3], [2.8, -12.5, 31.4, 4.1, 3.8, 2.8], [0, -9.5, 30.6, 4.6, 3.6, 2.4], [-0.6, -14.6, 32.4, 3, 2.8, 2.2]])
      translate([l[0], l[1], l[2]]) scale([l[3], l[4], l[5]]) sphere(1, $fn = 12);
  }
  // a few lumps on the heap
  for (l = [[4.6, -15, 29.6, 0], [-5.2, -12, 30, 30], [1, -8.6, 32, -20]])
    translate([l[0], l[1], l[2]]) rotate([0, 0, l[3]]) scale([2.6, 2.2, 1.6]) sphere(1, $fn = 8);
}
for (k = [0 : 13]) let(az = k * 360 / 14 + 6 + rnd(k + 80) * 10, el = asin((26.2 - H[0][2]) / H[1][2]), p = eP(H[0], H[1] + [0.6, 0.6, 0.6], az, el),
                       n = eN(H[1], az, el), front = abs(((az + 180) % 360) - 180) < 40)
  if (!inAny(p, B, 0.98))
    lock(p, n, [0, 0, -1], (front ? 3.4 : 2) + rnd(k + 40) * 2.4, 1.7 + rnd(k + 60) * 0.8, 0.75, snow, 9);

// Fierce blue eyes under a heavy brow slanting down to the trunk.
mirror_x() {
  eye([5.6, -18.1, 19.3], 2.6, iris = [0.15, 0.53, 0.88], pupil = [0.03, 0.1, 0.3], sclera = [0.86, 0.95, 1], yaw = 22,
      flat = 0.5, lid = 0.36, lid_tilt = 28, lid_c = face, slit = 0.8, shine = true);
  color(fur) hull() {
    translate([8.2, -16.8, 22.7]) scale([1.9, 1.5, 1.1]) sphere(1, $fn = 10);
    translate([2.5, -19.8, 21.2]) scale([1.3, 1.2, 0.8]) sphere(1, $fn = 8);
  }
}
// Trunk: short and thick, ridged, hanging between the tusks to z 7 and curling a little forward.
trunk = [[0, -18.8, 15.8], [0, -19.9, 12.6], [0, -20.3, 9.8], [0, -20.6, 7.6], [0, -21.4, 6.5]];
trunkR = [2.9, 2.7, 2.4, 2.1, 1.7];
chain(trunk, trunkR, face);
for (i = [0 : 3]) let(p = (trunk[i] + trunk[i + 1]) / 2, r = (trunkR[i] + trunkR[i + 1]) / 2)
  color(furDk) translate(p) rotate([-12, 0, 0]) scale([r * 1.04, r * 1.04, 0.3]) sphere(1, $fn = 12);
// Tusks: a short pale root under each cheek, then a big faceted ice crystal forward, down and out.
mirror_x() {
  limb([4.4, -17.4, 13.8], [5.3, -20.2, 11.7], 1.6, 1.5, root);
  crystal([5.3, -20.2, 11.7], [6.8, -27.5, 7.2], 2.3);
}
