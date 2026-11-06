// Rimetusk: Shagtusk evolved, a towering woolly mammoth under a glacier (sprite-match pass, 2026-11-04).
// Checklist (front sheet, 40 units tall):
// - body: a big shaggy bean of dark chocolate fur, sheet x -5..20, z 3..33, drawn as overlapping downward locks (the
//   Shagtusk fur technique, darker browns); a snow mantle over the back, lowest over the rump (front sheet x 11..21,
//   z 12..22), dripping in points; brown fur showing through it in holes (back sheet); ice droplets on the fur.
// - glacier: a heap of big faceted ice blocks over the shoulders and the back of the head (sheet x -12..13, z 27..40,
//   peak at sheet (1, 40)), spilling down the back; blue sides, snow-white tops.
// - head: high at the front (sheet x -14..2, z 9..30), a pale-blue ice V over the forehead coming down to a point
//   between the eyes (z 23), a big brown ear with a dark inside behind the near eye (sheet -0.3..4.5, z 23..29).
// - face: two slanted glaring eyes, pale ice-blue in a dark rim (near at sheet (-2.9, 23), far at (-10.5, 22.8));
//   heavy brows; a long ridged trunk hanging to z 6 (sheet x -10..-5).
// - tusks: huge cream tusks curling out sideways into closed C spirals (near sheet -4..14, z 8.5..21.5; far -20.5..-10),
//   a thick blue ice crust round the outer edge, ice chunks on the near tusk's inner curve.
// - legs: four thick pillars with snow cuffs (zigzag tops, z 1..6) and dark ice toenails; a short tail with an ice tip.
include <lib.scad>

furLt = [0.56, 0.39, 0.27];
fur = [0.45, 0.3, 0.22];
furDk = [0.33, 0.23, 0.17];
furDeep = [0.22, 0.16, 0.14];
face = [0.5, 0.34, 0.24];
snow = [0.82, 0.92, 0.92, NOGLOW];
ice = [0.5, 0.7, 0.82, NOGLOW];
iceLt = [0.62, 0.8, 0.88, NOGLOW];
iceDk = [0.33, 0.5, 0.64, NOGLOW];
ivory = [0.93, 0.91, 0.81, NOGLOW];

// Deterministic jitter in [0, 1).
function rnd(i) = let(x = sin(i * 127.1 + 31.7) * 4375.85) x - floor(x);
function eP(c, r, az, el) = c + [r[0] * cos(el) * sin(az), -r[1] * cos(el) * cos(az), r[2] * sin(el)];
function eN(r, az, el) = let(n = [cos(el) * sin(az) / r[0], -cos(el) * cos(az) / r[1], sin(el) / r[2]]) n / norm(n);
function inE(p, c, r, f = 1) = pow((p[0] - c[0]) / r[0], 2) + pow((p[1] - c[1]) / r[1], 2) + pow((p[2] - c[2]) / r[2], 2) < f * f;
function inAny(p, regs, f = 1) = len([for (s = regs) if (inE(p, s[0], s[1], f)) 1]) > 0;

// A fur lock (as Shagtusk's): a flat teardrop lying on the surface at p (normal n), pointing down the surface (along
// g projected), `len` long, `w` wide, `t` thick, its tip bent back towards a surface of radius R so it hugs the body.
function lockFrame(n, g) = let(gd = g / norm(g), d0 = gd - n * (gd * n), d = norm(d0) < 0.15 ? [0, 1, 0] : d0 / norm(d0),
                               u = cross(d, n)) [u / norm(u), d, n];
module lock(p, n, g, len, w, t, c, R = 11) let(F = lockFrame(n, g))
  color(c) multmatrix([[F[0][0], F[1][0], F[2][0], p[0]], [F[0][1], F[1][1], F[2][1], p[1]],
                       [F[0][2], F[1][2], F[2][2], p[2]], [0, 0, 0, 1]]) hull() {
    translate([0, 0, -t * 0.3]) scale([w, w * 0.8, t]) sphere(1, $fn = 8);
    translate([0, len * 0.5, t * 0.15 - len * len / (8 * R)]) scale([w * 0.75, 0.6, t * 0.8]) sphere(1, $fn = 6);
    translate([0, len, t * 0.35 - len * len / (2 * R)]) scale([0.5, 0.5, 0.4]) sphere(1, $fn = 4);
  }
// A faceted ice crystal from a to b, widest (r) a third of the way.
module crystal(a, b, r) {
  color(iceLt) hull() {
    translate(a) sphere(r * 0.65, $fn = 6);
    translate(a + (b - a) * 0.35) rotate([0, 0, 30]) sphere(r, $fn = 6);
    translate(b) sphere(0.12, $fn = 4);
  }
}

// ---- Body: overlapping masses along the spine, dark fur under the locks.
B = [[[0, -1, 20], [12.5, 10, 12.5]], [[0, 6, 18.5], [12.5, 9, 11.5]], [[0, 13, 15.5], [12, 10, 10.5]]];
H = [[0, -9.5, 22], [9.5, 8, 9]];
M = [[0, -13.5, 16.5], [5.6, 4.5, 5]];
module bodyShape(g = 0) for (e = B) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 24);
module bodyHull(g = 0) hull() for (e = B) translate(e[0]) scale(e[1] + [g, g, g]) sphere(1, $fn = 26);
color(furDk) bodyShape();

// The snow line of the mantle: snow above it, fur below; much lower over the rump.
function snowZ(y) = max(14, 25.5 - 0.75 * y);

// Locks over one body mass (Shagtusk's furOver): skip the parts buried in the other masses, the head and the snow;
// just below the snow line they turn to snow drips.
module furOver(i, els, seed) let(c = B[i][0], r = B[i][1])
  for (ei = [0 : len(els) - 1]) let(el0 = els[ei], m = max(6, round(15 * cos(el0))))
    for (k = [0 : m - 1]) let(id = seed + ei * 37 + k, az = k * 360 / m + ei * 13 + rnd(id) * 8,
                              el = el0 + (rnd(id + 5) - 0.5) * 6, p = eP(c, r, az, el), n = eN(r, az, el),
                              sz = snowZ(p[1]), drip = p[2] > sz - 3 && rnd(id + 17) < 0.7)
      if (p[2] < sz + 0.3 && !inAny(p, [for (j = [0 : 2]) if (j != i) B[j]], 0.96) && !inE(p, H[0], H[1], 1.1))
        lock(p, n, [0, 0.3, -1], (5.4 + rnd(id + 9) * 1.4) * (drip ? 0.8 + rnd(id + 21) * 0.7 : 1) * (el0 < -30 ? 1.2 : 1),
             2.8 + rnd(id + 3) * 0.6, 0.7, drip ? (rnd(id + 23) < 0.5 ? snow : iceLt) : (rnd(id + 7) < 0.55 ? fur : furLt));
furOver(0, [-36, -16, 4, 23], 0);
furOver(1, [-36, -16, 4, 23], 300);
furOver(2, [-36, -16, 4, 23, 40], 600);

// Snow mantle over the back with brown fur showing through it in holes.
module aboveSnow() for (y = [-14 : 4 : 26]) hull() {
  translate([0, y, snowZ(y) + 10]) cube([30, 0.01, 20], center = true);
  translate([0, y + 4, snowZ(y + 4) + 10]) cube([30, 0.01, 20], center = true);
}
HOLES = [[[8.6, 6, 26.4], [2.4, 2.8, 2.2]], [[-9.4, 8, 24], [2.2, 2.6, 2.2]], [[9.6, 15, 20.6], [2, 2.6, 2]],
         [[-6, 16, 22.6], [2.4, 2.4, 2]], [[-10.4, -1, 26.4], [2, 2.4, 2]]];
color(snow) difference() {
  intersection() { bodyHull(0.9); aboveSnow(); }
  for (h = HOLES) translate(h[0]) scale(h[1]) sphere(1, $fn = 10);
}
color(fur) intersection() { bodyHull(0.7); union() for (h = HOLES) translate(h[0]) scale(h[1] + [0.1, 0.1, 0.1]) sphere(1, $fn = 10); }
// Ice droplets frozen on the fur, pointing up: [mass, azimuth, elevation].
for (d = [[0, 78, -12], [0, 104, -32], [1, 70, 2], [1, 112, -24], [2, 96, 6], [2, 128, -22], [0, -84, -16], [1, -100, -4],
          [2, -112, -26], [2, 180, -12], [1, -72, -36], [2, 150, 10]])
  let(c = B[d[0]][0], r = B[d[0]][1], p = eP(c, r, d[1], d[2]), n = eN(r, d[1], d[2]))
    color(iceLt) hull() {
      translate(p + n * 1.1) scale([1, 1, 1.1]) sphere(1.15, $fn = 8);
      translate(p + n * 1.2 + [0, 0, 1.8]) sphere(0.2, $fn = 4);
    }

// ---- Glacier: big faceted ice blocks heaped over the shoulders and the back of the head, spilling down the back;
// each block a hull of two turned cubes, blue sides and a snow-white top. [centre, size, turn a, turn b]
G = [[[0.5, 1, 32.4], 8.5, [20, 10, 15], [-15, 30, 50]],
     [[-2.6, -7.4, 30.8], 7.3, [10, -20, 30], [35, 15, -10]],
     [[4.4, -5, 30.4], 6.6, [-25, 15, 10], [10, 40, 70]],
     [[-5.4, -0.5, 30.2], 7.1, [30, 20, -20], [-10, -25, 40]],
     [[5.4, 4.5, 30.6], 7.1, [15, -30, 25], [40, 5, -35]],
     [[0, 9.5, 28.6], 7.3, [-20, 25, 5], [20, -15, 60]],
     [[-5.2, 12.5, 25.6], 5.2, [35, 10, 40], [-5, 30, -20]],
     [[5.4, 14, 24.4], 5.4, [5, 35, -15], [30, -20, 20]],
     [[0, 18, 22], 4.5, [25, -10, 30], [-20, 25, 5]],
     [[7.6, 9, 25.4], 5.9, [10, 25, 40], [-20, 10, 15]],
     [[-7.6, 5.5, 26.8], 6.1, [-15, 20, 10], [25, -10, 50]]];
module block(g) translate(g[0]) hull() {
  rotate(g[2]) cube(g[1], center = true);
  translate([0, 0, g[1] * 0.42]) rotate(g[3]) cube(g[1] * 0.6, center = true);
}
for (g = G) {
  color(ice) block(g);
  color(snow) intersection() {
    translate(g[0]) scale(1.03) translate(-g[0]) block(g);
    translate(g[0] + [0, 0, g[1] * 0.3 + 10]) cube([30, 30, 20], center = true);
  }
}

// ---- Legs: thick pillars, a ring of locks at the knee, snow cuffs with zigzag tops, dark ice toenails.
LEGS = [[7.6, -9.5], [-7.6, -9.5], [7.6, 12.5], [-7.6, 12.5]];
for (q = LEGS) {
  limb([q[0], q[1], 10.5], [q[0], q[1], 4.6], 4.2, 4.4, fur);
  color(furDk) translate([q[0], q[1], 2.2]) scale([4.5, 4.5, 2.2]) sphere(1, $fn = 16);
  color(snow) translate([q[0], q[1], 3.4]) scale([4.85, 4.85, 2.3]) sphere(1, $fn = 16);
  for (a = [0 : 60 : 359]) let(n = [sin(a), -cos(a), 0])
    lock([q[0], q[1], 3.8] + n * 4.6, n, [0, 0, 1], 1.6 + rnd(a + q[1]) * 0.9, 2.2, 0.55, a % 120 == 0 ? snow : iceLt, 8);
  for (a = [0 : 60 : 359]) let(id = 900 + a + q[1] + q[0], n = [sin(a + 30), -cos(a + 30), 0])
    lock([q[0], q[1], 10] + n * 4.3, n, [0, 0, -1], 3.6, 2.6, 0.65, rnd(id) < 0.5 ? fur : furLt, 30);
  for (a = [-38, 0, 38]) color(iceDk) translate([q[0] + 4.3 * sin(a), q[1] - 4.3 * cos(a), 1]) rotate([0, 0, a])
    scale([1.2, 0.9, 1]) sphere(1, $fn = 8);
}
// Tail: a short furry stub, an ice crystal tip pointing back and down.
limb([0, 20, 18.5], [0, 24, 13.5], 1.7, 1.2, fur);
crystal([0, 24, 13.5], [0, 26.6, 9.6], 1.4);

// ---- Head: high at the front, a fuller muzzle under the eyes; shaggy cheeks.
color(face) translate(H[0]) scale(H[1]) sphere(1, $fn = 30);
color(face) translate(M[0]) scale(M[1]) sphere(1, $fn = 22);
for (ei = [0 : 2]) let(el0 = [-26, -6, 12][ei], m = 14)
  for (k = [0 : m - 1]) let(id = 1200 + ei * 37 + k, az = k * 360 / m + ei * 11 + rnd(id) * 8,
                            azf = abs(((az + 180) % 360) - 180), el = el0 + (rnd(id + 5) - 0.5) * 6,
                            p = eP(H[0], H[1], az, el), n = eN(H[1], az, el))
    if (azf > 55 && azf < 140 && !inAny(p, B, 0.98))
      lock(p, n, [0, 0, -1], 4.2 + rnd(id + 9) * 1.4, 2.5 + rnd(id + 3) * 0.5, 0.75, rnd(id + 7) < 0.5 ? face : fur, 9);
// Ice over the crown, coming down the forehead in a V to a point between the eyes.
color(iceLt) intersection() {
  translate(H[0]) scale(H[1] + [0.9, 0.9, 0.9]) sphere(1, $fn = 26);
  translate([0, 0, 23.4]) rotate([0, 50, 0]) translate([-50, -50, 0]) cube(100);
  translate([0, 0, 23.4]) rotate([0, -50, 0]) translate([-50, -50, 0]) cube(100);
}
// Ears: big shaggy flaps on the sides of the head, dark inside.
mirror_x() translate([9, -9.6, 25.6]) rotate([0, -12, -50]) {
  color(fur) scale([1.2, 3.8, 4.4]) sphere(1, $fn = 14);
  color(furDeep) translate([0.55, 0, -0.3]) scale([0.8, 2.7, 3.3]) sphere(1, $fn = 12);
}

// Glaring ice-blue eyes in a dark rim under heavy brows slanting down to the trunk.
mirror_x() {
  eye([5, -15.9, 23], 2.4, iris = [0.5, 0.84, 1, NOGLOW], pupil = [0.92, 0.98, 1, NOGLOW], sclera = [0.12, 0.2, 0.36],
      yaw = 26, flat = 0.5, lid = 0.3, lid_tilt = 30, lid_c = face, slit = 0.9, shine = false);
  color(furDk) hull() {
    translate([7.6, -14.2, 26.4]) scale([1.3, 1, 0.65]) sphere(1, $fn = 10);
    translate([2.4, -17.2, 24.9]) scale([0.9, 0.9, 0.55]) sphere(1, $fn = 8);
  }
}
// Trunk: long and ridged, hanging between the tusks to z 6 and curling forward at the tip.
trunk = [[0, -16.8, 19.5], [0, -17.9, 15.5], [0, -18.4, 12], [0, -18.6, 9], [0, -19, 6.6], [0, -20.4, 5.8]];
trunkR = [3, 2.7, 2.4, 2.1, 1.8, 1.4];
chain(trunk, trunkR, face);
for (i = [0 : 4]) let(p = (trunk[i] + trunk[i + 1]) / 2, r = (trunkR[i] + trunkR[i + 1]) / 2)
  color(furDk) translate(p) rotate([-10, 0, 0]) scale([r * 1.04, r * 1.04, 0.3]) sphere(1, $fn = 12);

// Tusks: huge cream spirals curling out sideways, a thick blue ice crust round the outer edge, ice chunks inside.
tuskPts = [[4.6, -14.6, 17.5], [6.6, -15.8, 12.8], [10.4, -16.2, 10], [14.6, -14.2, 11.8], [16.4, -11.6, 15.5],
           [15.4, -11, 19.6], [13, -12, 21], [11.6, -12.6, 19]];
tuskR = [2.1, 2.2, 2.2, 2.1, 1.9, 1.6, 1.2, 0.8];
curlC = [12.4, -13, 15.6];
function chaikin(v) = concat([v[0]], [for (i = [0 : len(v) - 2], f = [0.25, 0.75]) v[i] * (1 - f) + v[i + 1] * f], [v[len(v) - 1]]);
tP = chaikin(tuskPts);
tR = chaikin(tuskR);
mirror_x() {
  chain(tP, tR, ivory, $fn = 9);
  crust = [for (i = [2 : len(tP) - 2]) let(d = tP[i] - curlC, n = d / norm(d)) tP[i] + n * tR[i] * 0.62];
  chain(crust, [for (i = [2 : len(tP) - 2]) tR[i] * 0.86], ice, $fn = 7);
  // snow on the crust's top and the ice chunks resting in the curve
  for (i = [4 : 3 : len(crust) - 1]) color(snow) translate(crust[i] + [0, -0.4, 0.5]) sphere(tR[i + 2] * 0.6, $fn = 8);
  for (c = [[8.4, -16.4, 12.6, 1.3], [11.2, -16.2, 11.6, 1.1], [13.8, -14.8, 13, 1]])
    color(iceLt) translate([c[0], c[1], c[2]]) rotate([20, 30, c[0] * 10]) cube(c[3] * 1.5, center = true);
}
