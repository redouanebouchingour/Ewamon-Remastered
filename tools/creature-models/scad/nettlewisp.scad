// Nettlewisp: a leafy forest-spirit cat. Checklist from the sprite (front sheet, 40 tall; the art's figure is turned
// to the viewer's left, its centre line reads at sheet x -1.8, the near foot stands on sheet z 1.4):
//   - head: a big round cat head (sheet x -14..0.5, z 18..31.5), moss green, turned a little towards the viewer;
//     a wide pale face mask (x -11.6..0, z 18.4..26.8) with a pale-green forehead and light moss bangs over it.
//   - face: two big almond green eyes (near x -5.4..-1.4, far -10.8..-8.5, z 22..24.7) under heavy dark upper lids
//     sloping to the nose, a pale highlight; a dark teal inverted-triangle nose (x -8.5..-6.3, z 21..22) and a small
//     "w" mouth. A calm, slightly smug look.
//   - ears: pointed cat ears at the head's top corners (near x 0.4..4.4, z 26..31) with pale-green insides.
//   - antlers: two brown branching antlers (far x -13..-7, near -4.4..4.8, z 28.5..40), each a beam, an outer tine,
//     an inner tine and the top tip.
//   - body: a messy mass of leaves and moss (x -13..7, z 4..19), many small leaf plates in four greens, a ragged
//     outline, darker at the back and underneath; a glowing four-dot clover on the near chest (x -2.7..1, z 14..17.4).
//   - legs: short dark mossy stumps, feet apart (far x -10.5..-4.5, near 0..9) with pale leaf toes.
//   - arms: long drooping leafy vines (far one out to x -20 at z 7..16, near one down to the ground at x 16..18)
//     with dangling vine strands and pale leaves.
//   - tail: a brown vine from the near hip curling up and out (x 8..17, z 11..19) to a big leafy tuft (x 13..20,
//     z 17..27) of pale and light leaves.
//   - back: dark mossy back with a glowing clover on the back of the head, another low on the back (the far side),
//     a pale oval leaf on the near side of the back; the tail stem and tuft on the creature's +X.
//   - loose leaves drifting round it (not part of the body; one drift joint in the rig).
include <lib.scad>

moss = [0.2, 0.36, 0.18];
mossMid = [0.3, 0.46, 0.21];
mossLight = [0.35, 0.55, 0.23, NOGLOW];
mossDark = [0.11, 0.19, 0.13];
mossCore = [0.15, 0.27, 0.14];
leafPale = [0.66, 0.78, 0.51, NOGLOW];
face = [0.82, 0.89, 0.63, NOGLOW];
antler = [0.45, 0.38, 0.26];
vine = [0.32, 0.29, 0.18];
ink = [0.05, 0.13, 0.07];
eyeC = [0.24, 0.52, 0.3];
iris = [0.45, 0.78, 0.42, NOGLOW];
pupilC = [0.1, 0.33, 0.16];
noseC = [0.02, 0.3, 0.2];
glow = [0.85, 1, 0.55, GLOW];

// Sheet point -> scad point at depth y (the figure's centre line reads at sheet x -1.8; the 10 degree camera pitch
// lifts parts further back; the near foot lands on sheet z 1.4).
OFS = -1.8;
function S(sx, sz, y = 0) = let(x = (sx - OFS - 0.5 * y) / 0.866, d = -0.5 * x + 0.866 * y) [x, y, sz - 2.42 - 0.17 * d];

// A leaf plate anchored at p, hanging along -Z with its face turned to azimuth a (degrees round Z, 0 = +X) and its
// tip tilted `tilt` degrees out (tilt > 90 points it up). L long, w wide, t thick: a low diamond, pointed at both ends.
LEAF = [[0, 0, 1], [0, 0, -1], [1, 0, 0.15], [0, 1, 0], [-1, 0, 0.15], [0, -1, 0]];
LEAFF = [[0, 3, 2], [0, 4, 3], [0, 5, 4], [0, 2, 5], [1, 2, 3], [1, 3, 4], [1, 4, 5], [1, 5, 2]];
module lf(p, a, tilt, L, w, c, t = 0.3) {
  color(c) translate(p) rotate([0, 0, a - 90]) rotate([tilt, 0, 0]) translate([0, 0, -L / 2]) scale([w / 2, t, L / 2]) polyhedron(LEAF, LEAFF);
}
// Deterministic jitter in -1..1.
function jit(i) = sin(i * 137.508 + 11);

// ---------------------------------------------------------------- body: a mass of leaves over a moss core
BODY = [[[9.3, 8, 4.6], [0, -1, 9.6]], [[8.4, 7.3, 5], [0, -1, 14.2]]];
blob(BODY, mossCore);
// The body's half-width at height z (the blob's outline), for anchoring the leaves on it.
function bodyR(z) = z < 9.6 ? 9.3 * sqrt(max(0, 1 - pow((z - 9.6) / 4.6, 2))) : z < 14.2 ? 9.3 - 0.9 * (z - 9.6) / 4.6 : 8.4 * sqrt(max(0, 1 - pow((z - 14.2) / 5, 2)));
CLOVER = [5.4, -7.4, 14.6];   // the glowing clover on the near chest
// rings of leaves: [z, count, length, tilt]
RINGS = [[5.4, 26, 3.8, 20], [6.7, 30, 3.2, 26], [8, 34, 3, 30], [9.3, 36, 2.9, 32], [10.6, 36, 2.9, 34], [11.9, 35, 2.8, 34],
         [13.2, 34, 2.8, 32], [14.5, 32, 2.7, 32], [15.8, 30, 2.6, 30], [17.1, 26, 2.5, 30], [18.3, 20, 2.4, 30], [19.3, 12, 2.2, 30]];
function leafC(i, a) = let(f = sin(a), m = i % 10)
  f < -0.25 ? (m < 3 ? mossLight : m < 6 ? mossMid : m < 9 ? moss : leafPale)
  : f < 0.35 ? (m < 3 ? mossMid : m < 7 ? moss : mossDark)
  : (m < 4 ? mossDark : m < 8 ? moss : mossMid);
for (r = [0 : len(RINGS) - 1], k = [0 : RINGS[r][1] - 1]) {
  i = r * 37 + k * 7;
  a = k * 360 / RINGS[r][1] + r * 9 + 5 * jit(i);
  z = RINGS[r][0] + 0.45 * jit(i + 5);
  rr = max(bodyR(z), 2.5) * 0.98;
  p = [rr * cos(a), -1 + rr * 0.85 * sin(a), z];
  if (norm(p - CLOVER) > 2.4) lf(p, a, RINGS[r][3] + 12 * jit(i + 2), RINGS[r][2] + 0.5 * jit(i + 9), 1.9 + 0.4 * jit(i + 3), leafC(i, a));
}
// A moss ruff round the shoulders, joining the head to the body.
for (k = [0 : 15]) {
  a = k * 360 / 16 + 8;
  if (sin(a) > -0.55) lf([8.2 * cos(a), -2.6 + 7.2 * sin(a), 19.6 + 0.5 * jit(k + 60)], a, 48 + 10 * jit(k + 61), 3.4, 2.4,
                         k % 3 == 0 ? mossDark : k % 3 == 1 ? moss : mossMid);
}
// Brown vine streaks down the front of the body.
color(vine) {
  limb([-2.6, -9.6, 13.6], [-3.6, -9.2, 8.4], 0.35, 0.3);
  limb([0.6, -9.8, 12.4], [1.4, -9.5, 7.6], 0.35, 0.3);
}
// A glowing clover: four dots in a square, laid on the surface facing azimuth a.
module clover(p, a, s = 1) {
  translate(p) rotate([0, 0, a - 90]) for (k = [0 : 3])
    color(glow) translate([cos(k * 90 + 45), 0, sin(k * 90 + 45)] * 0.95 * s) scale([0.62, 0.4, 0.62] * s) sphere(1, $fn = 10);
}
clover(CLOVER, -58);
// Back markings: a clover low on the far side of the back, a pale oval leaf on the near side.
clover([-3.6, 6.3, 15.4], 112, 0.95);
color(leafPale) translate([4.8, 6, 10.8]) rotate([0, 0, 52]) rotate([0, -12, 0]) scale([1.5, 0.5, 2.3]) sphere(1, $fn = 14);

// ---------------------------------------------------------------- legs: short dark stumps with pale leaf toes
mirror_x() {
  limb([4.8, 0, 7], [7.1, 0.8, 2.2], 2.7, 2.3, mossDark);
  ell([2.6, 3.4, 1.4], [7.2, 0.2, 1.4], mossDark);
  lf([6.4, -2.8, 1.5], -110, 80, 1.8, 1.2, leafPale);
  lf([8, -2.6, 1.5], -70, 80, 1.8, 1.2, leafPale);
  lf([9.4, 0, 1.7], -20, 70, 1.7, 1.1, mossLight);
}

// ---------------------------------------------------------------- arms: long drooping leafy vines
// The near arm (+X) hangs low down its side to the ground; the far one (-X) reaches out higher (the art's pose).
ARML = [[7.6, -1.6, 15.8], [12, -2.4, 12.8], [16, -2.4, 9.6], [19, -2, 6.8]];
ARMR = [[-7.6, -1.6, 15.8], [-12, -2.4, 14], [-15.8, -2.4, 12], [-18.6, -2, 10]];
ARMRAD = [1.5, 1.15, 0.9, 0.65];
// strands: [from, mid, end] per arm, the near arm's long, the far arm's short
STRL = [[[12.2, -2.4, 12.4], [12.8, -3, 9.4], [12.6, -3, 6.4]], [[16, -2.4, 9.2], [16.8, -2.6, 6.2], [16.6, -2.4, 3]],
        [[18.8, -2, 6.6], [19.6, -1.8, 3.8], [19.2, -1.8, 1.4]]];
STRR = [[[-12.2, -2.4, 13.6], [-12.8, -3, 11.2], [-12.6, -3, 9]], [[-15.8, -2.4, 11.6], [-16.6, -2.6, 9.2], [-16.4, -2.4, 6.8]],
        [[-18.4, -2, 9.8], [-19.2, -1.8, 7.6], [-18.8, -1.8, 5.4]]];
module arm(A, ST) {
  sg = sign(A[0][0]);
  chain(A, ARMRAD, moss);
  // a sleeve of leaves along the arm: one in front, one behind and one on top at each station, all hanging
  for (j = [0 : 11], q = [0 : 2]) {
    u = (j + 0.5) / 12;
    seg = min(2, floor(u * 3));
    f = u * 3 - seg;
    p = A[seg] + (A[seg + 1] - A[seg]) * f;
    rad = ARMRAD[seg] + (ARMRAD[seg + 1] - ARMRAD[seg]) * f;
    i = j * 3 + q + (sg > 0 ? 0 : 50);
    off = q == 0 ? [0, -rad * 0.8, 0] : q == 1 ? [0, rad * 0.8, 0] : [0, 0, rad * 0.8];
    az = q == 0 ? -90 : q == 1 ? 90 : 90 - 90 * sg + 40 * jit(i);
    lf(p + off, az, (q == 2 ? 40 : 22) + 12 * jit(i + 7), 3 + 0.5 * jit(i + 3), 2 + 0.3 * jit(i + 1),
       i % 5 == 0 ? mossLight : i % 5 == 1 ? mossMid : i % 5 == 2 ? moss : i % 5 == 3 ? mossDark : (q == 0 ? leafPale : moss));
  }
  // dangling vine strands with a leaf at each end
  for (k = [0 : 2]) {
    chain(ST[k], [0.42, 0.34, 0.27] * (1 - 0.06 * k), k == 1 ? vine : mossDark);
    lf(ST[k][2] + [0, 0, 0.3], k == 0 ? -90 : 90 - 90 * sg, 10 + 4 * k, 2.4, 1.6, k == 1 ? mossLight : leafPale);
  }
  lf(A[3] + [0, 0, 0.4], 90 - 90 * sg, 25, 3, 2, leafPale);
}
arm(ARML, STRL);
arm(ARMR, STRR);

// ---------------------------------------------------------------- tail: a brown vine to a leafy tuft (+X side)
TAIL = [[3, 6, 9], [8, 9, 9.4], [12.6, 10, 11.4], [15.2, 9, 13.8], [16.2, 8, 16.6]];
chain(TAIL, [1, 0.9, 0.8, 0.7, 0.6], vine);
lf([9.6, 9.6, 10.3], 0, 40, 2, 1, mossLight);
lf([13.8, 9.6, 12.6], 90, 40, 2, 1, moss);
TUFT = [16.2, 8, 16.6];
color(mossMid) translate(TUFT + [0, 0, 3]) scale([2.2, 1.8, 3.6]) sphere(1, $fn = 14);
for (k = [0 : 23]) {
  a = k * 360 / 24 * 5;
  h = (k % 4) / 3;
  lf(TUFT + [2 * cos(a) * (1 - 0.3 * h), 1.6 * sin(a) * (1 - 0.3 * h), 0.8 + 4.6 * h], a, 128 - 40 * h + 12 * jit(k), 4 - 0.6 * h, 2.4,
     k % 3 == 0 ? leafPale : k % 3 == 1 ? mossLight : (k % 2 == 0 ? mossMid : leafPale));
}
lf(TUFT + [0, 0, 6.4], 0, 176, 2.6, 2.2, leafPale);
lf(TUFT + [0.4, -0.6, 5.8], -60, 160, 2.6, 2, mossLight);

// ---------------------------------------------------------------- head (turned 12 degrees towards the viewer)
HC = [0, -6, 23.75];
HYAW = 12;
HS = 1.12;   // the head block is scaled up: the art's head is big
module head() { translate(HC) rotate([0, 0, HYAW]) scale(HS) children(); }
HEAD = [7.7, 6.4, 5.9];
EYES = [1.25, 1, 0.8];
head() {
  ell(HEAD, [0, 0, 0], moss);
  // the pale face mask over the front: cheeks, muzzle and round the eyes
  color(face) intersection() {
    scale(HEAD + [0.22, 0.22, 0.22]) sphere(1, $fn = 26);
    translate([0, -7, -1.8]) scale([7.6, 5.6, 4.6]) sphere(1, $fn = 28);
  }
  // light moss over the crown, coming down to the forehead
  color(mossLight) intersection() {
    scale(HEAD + [0.18, 0.18, 0.18]) sphere(1, $fn = 24);
    translate([0, -5.4, 4.3]) scale([6.6, 4.6, 2.6]) sphere(1, $fn = 24);
  }
  // the pale forehead between the eyes, under the moss
  color(leafPale) intersection() {
    scale(HEAD + [0.24, 0.24, 0.24]) sphere(1, $fn = 24);
    translate([0, -7, 1.6]) scale([2.6, 4.6, 1.8]) sphere(1, $fn = 20);
  }
  // cheek tufts: pale fur flaring out at the bottom of the mask
  mirror_x() {
    lf([5.6, -3.9, -2], -20, 70, 2.6, 1.2, face);
    lf([4.8, -4.6, -3.6], -40, 60, 2.2, 1.1, face);
  }
  // muzzle, nose and the little "w" mouth
  color(face) translate([0, -5.3, -2.9]) scale([2.3, 1.4, 1.5]) sphere(1, $fn = 18);
  color(noseC) hull() {
    translate([-0.8, -6.6, -1.9]) sphere(0.3, $fn = 8);
    translate([0.8, -6.6, -1.9]) sphere(0.3, $fn = 8);
    translate([0, -6.7, -2.7]) sphere(0.25, $fn = 8);
  }
  color(ink) {
    limb([0, -6.6, -2.7], [0, -6.5, -3.3], 0.13, 0.13);
    mirror_x() {
      limb([0, -6.5, -3.3], [0.5, -6.45, -3.6], 0.13, 0.13);
      limb([0.5, -6.45, -3.6], [1, -6.3, -3.3], 0.13, 0.13);
    }
  }
  // eyes: big almond green eyes under heavy dark lids sloping to the nose
  // (each eye is drawn wide and short: an almond)
  mirror_x() translate([3.3, -5.35, -0.6]) scale(EYES) eye([0, 0, 0], 1.6, iris = iris, sclera = eyeC, pupil = pupilC, yaw = 18,
                 flat = 0.42, lid = 0.3, lid_tilt = 12, lid_c = ink, squint = 0.16, shine = true);
  // moss bangs hanging over the forehead
  for (k = [0 : 3]) {
    x = -3 + k * 2;
    lf([x, -5.75 + 0.2 * abs(x), 3.7 - 0.06 * x * x], -90 + x * 6, 8, 2, 1.4, mossLight, t = 0.25);
  }
  // the moss crown: soft tufts rising off the top of the head
  for (k = [0 : 5]) {
    a = -150 + k * 36;
    lf([4.2 * cos(a), 3 * sin(a) + 0.6, 4.6], a, 128 + 14 * jit(k + 20), 2.6 + 0.8 * (k % 2), 2, k % 2 == 0 ? mossLight : moss);
  }
  // moss leaves over the top, sides and back of the head (the face left bare)
  for (r = [0 : 3], k = [0 : 15]) {
    el = [-30, 0, 28, 52][r];
    a = k * 360 / 16 + r * 11;
    i = r * 19 + k * 5;
    if (!(sin(a) < -0.45 && el < 40))
      lf([HEAD[0] * cos(el) * cos(a), HEAD[1] * cos(el) * sin(a), HEAD[2] * sin(el) + 0.9], a, 26 + 10 * jit(i), 2.8 + 0.4 * jit(i + 1), 2 + 0.3 * jit(i + 2),
         i % 4 == 0 ? mossLight : i % 4 == 1 ? moss : i % 4 == 2 ? mossMid : (sin(a) > 0.3 ? mossDark : moss));
  }
  // ragged moss mane round the sides and back of the head
  for (k = [0 : 13]) {
    a = -40 + k * 20;
    z = -1.2 + 2.4 * jit(k + 30);
    lf([7.2 * cos(a), 6 * sin(a), z + 1.6], a, 45 + 20 * jit(k + 31), 3.4, 2.4, k % 3 == 0 ? mossDark : k % 3 == 1 ? moss : mossMid);
  }
  // the glowing clover on the back of the head
  clover([1.6, 6.3, 1.4], 78, 1.05);

  // pointed cat ears at the top corners, pale inside
  mirror_x() {
    color(moss) hull() {
      translate([5.4, -0.6, 2.8]) scale([1.7, 0.95, 1.2]) sphere(1.6, $fn = 16);
      translate([7.5, -0.9, 7.4]) sphere(0.35, $fn = 8);
    }
    color(leafPale) hull() {
      translate([5.5, -2.05, 3.3]) scale([1.2, 0.35, 0.8]) sphere(1.6, $fn = 14);
      translate([7.25, -1.5, 6.8]) sphere(0.25, $fn = 8);
    }
  }

  // branching brown antlers rising from the top of the head
  mirror_x() {
    chain([[2.9, 0.6, 4.4], [4.2, 1.3, 7.8], [4.7, 1.9, 10.8], [4.3, 2.2, 12.8]], [1.05, 0.88, 0.68, 0.45], antler);
    chain([[4.2, 1.3, 7.8], [6.4, 1.8, 9.2], [7.7, 2, 11.1]], [0.72, 0.56, 0.38], antler);
    limb([4.7, 1.9, 10.8], [6.5, 2.2, 12.2], 0.56, 0.36, antler);
    limb([4.5, 2, 9.9], [2.8, 2.1, 11.4], 0.54, 0.36, antler);
  }
}

// ---------------------------------------------------------------- loose leaves drifting round it
DRIFT = [[S(-15.6, 31.4, 0), 30], [S(5.4, 39.2, 2), -30], [S(11.8, 25.8, 0), 40], [S(-13.4, 36.6, 2), -40],
         [S(17.6, 10.6, 0), 20], [S(-15.4, 4.2, -2), -20]];
for (d = DRIFT) color(d[1] > 0 ? leafPale : mossLight) translate(d[0]) rotate([0, d[1], 20]) scale([0.65, 0.25, 1.15]) sphere(1, $fn = 10);
