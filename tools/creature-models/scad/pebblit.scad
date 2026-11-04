// Pebblit: a round lilac-grey rock golem baby. A dark plum boulder studded with many small pale pebbles, a pale face
// painted into the front under a dark hood rim (almond eyes, a wide smile, a pale crystal mark on the forehead), two
// pointed quartz clusters on top like ears, a pebble fist reaching out on its right, a crystal hand hanging on its
// left, and two pale crystal-clump feet.
//
// Checklist (front sheet, 43 x 40; the body sits 2.3 right of the sheet's centre, so every sheet x below is read
// relative to the body's centre and the scad body sits on x = 0):
//   body      round boulder, sheet x -11.8..16.4, z 8.5..34.5 -> ell R [13.3, 13, 12.3] at z 21.5, dark plum
//             [0.38, 0.25, 0.43]; pebbles small (2..3.5 across) and many on the front, bigger plates on the back
//   face      pale mask x -8.7..9.2, z 15.2..27.9, centred about 3 left of the body: the face is turned ~17 deg
//             towards the viewer (the creature's +X), a dark hood rim round it, no pebbles on it
//   eyes      two almonds ~4.5 x 3 (far -8..-3.5, near 1.6..7.1, z 20..24.5): pale sclera, big grey iris, dark
//             pupil, a dark upper lid line; painted flush, not goggles
//   mouth     a wide thin smile x -5.8..1.3, z 17..19.1 (lowest at z 17.1)
//   forehead  a pale crystal diamond at x -0.5, z 25..28 running up into the hood
//   crystals  two chunky quartz clusters (ears): near x 5.2..13.2, z 30..38.4 leaning out; far x -4.9..1, z 32..39.7
//   arms      far (-X): pebble fist reaching forward-left, x -21.4..-14, z 14.6..23 (dark, pink pebbles);
//             near (+X): a pebbly upper arm x 14..20, z 12..18.5 and a pale crystal hand below, z 7..16
//   legs      squat heaps of pale pebbles with short crystal toes; near: pale clump x 4.6..14.7, z 0..9.3; far: x -14.2..-4.5, z 3.8..11.4 (stood level here)
//   back      big lilac stone plates with dark cracks
include <lib.scad>

rock = [0.38, 0.25, 0.43];
rockDark = [0.22, 0.11, 0.29];
peb1 = [0.70, 0.61, 0.68];
peb2 = [0.80, 0.72, 0.78];
peb3 = [0.88, 0.81, 0.86];
pebBack = [0.76, 0.68, 0.74];
pale = [0.80, 0.72, 0.79];
paleHi = [0.88, 0.81, 0.86];
face = [0.88, 0.83, 0.88];
mark = [0.96, 0.92, 0.95];
quartz = [0.92, 0.84, 0.88];
quartzShade = [0.82, 0.72, 0.79];
ink = [0.27, 0.14, 0.33];
sclera = [0.99, 0.97, 0.99];
iris = [0.50, 0.44, 0.52];
pupil = [0.16, 0.07, 0.24];

C = [0, 0, 21.1];        // the boulder's centre
R = [13.3, 13, 12.6];    // its radii
FA = 17;                 // the face is turned this far towards +X (the viewer), as drawn

function hsh(i) = let(v = sin(i * 127.1 + 31.7) * 43758.5453) v - floor(v);

module crystal(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.72, r = r, $fn = 6);
    translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.3 * r, $fn = 6);
  }
}

// a flat pebble lying on a surface at p with outward normal n, radii a x b, turned `spin` about the normal
module peb(p, n, a, b, spin, c) {
  color(c) translate(p) rotate(_dir_rot(n)) rotate([0, 0, spin]) scale([a, b, 0.5 * min(a, b)]) sphere(1, $fn = 7);
}

// the face's own frame: centred on the boulder, turned FA towards +X, the face looking along -Y
module faceFrame() { translate(C) rotate([0, 0, FA]) children(); }
// a 2D shape in the face frame's (x, z), pushed out through the front of the boulder
module facePrint() { faceFrame() rotate([90, 0, 0]) linear_extrude(height = 30) children(); }

// ---- the boulder
ell(R, C, rock);

// pebbles all over it (a Fibonacci spiral), none on the face; small on the front, broad plates on the back
N = 230;
for (i = [0 : N - 1]) {
  nz = max(-1, min(1, 1 - 2 * (i + 0.5) / N + 0.012 * (hsh(i + 900) - 0.5)));
  rr = sqrt(1 - nz * nz);
  th = i * 137.508 + 14 * (hsh(i + 1000) - 0.5);
  n = [rr * cos(th), rr * sin(th), nz];
  q = [R[0] * n[0], R[1] * n[1], R[2] * n[2]];
  lx = q[0] * cos(FA) + q[1] * sin(FA);
  ly = -q[0] * sin(FA) + q[1] * cos(FA);
  inFace = ly < 0 && pow(lx / 10.6, 2) + pow((q[2] + 0.9) / 7.8, 2) < 1;
  back = max(0, n[1]);
  h = hsh(i);
  s = 1.75 + 1.2 * back + 0.5 * h;
  if (!inFace && nz > -0.86 && !(back > 0.45 && i % 2 == 1))
    peb(C + q * 0.985, n, s * (0.85 + 0.4 * h), s * (1.15 - 0.3 * h), h * 180,
        back > 0.35 ? (h < 0.5 ? pebBack : peb2) : (h < 0.2 ? peb1 : h < 0.6 ? peb2 : peb3));
}

// ---- the face, painted flush into the front
color(rockDark) intersection() { ell(R + [0.12, 0.12, 0.12], C); facePrint() translate([0, -0.9]) scale([9.9, 7.1]) circle(1, $fn = 40); }
color(face) intersection() { ell(R + [0.25, 0.25, 0.25], C); facePrint() translate([0, -0.9]) scale([8.7, 5.9]) circle(1, $fn = 40); }
// the pale crystal mark on the forehead, running up into the hood
color(mark) intersection() {
  ell(R + [0.36, 0.36, 0.36], C);
  facePrint() polygon([[0.1, 6.6], [1.1, 4.6], [0.5, 2.6], [-0.3, 2.6], [-0.9, 4.6]]);
}
// the wide smile: a thin crescent
color(ink) intersection() {
  ell(R + [0.42, 0.42, 0.42], C);
  facePrint() translate([-0.6, -2.2]) difference() {
    scale([4.7, 1.9]) circle(1, $fn = 36);
    translate([0, 0.55]) scale([4.7, 1.8]) circle(1, $fn = 36);
    translate([-5, 0.2]) square([10, 4]);
  }
}

// eyes: almonds (each eye() squashed about its centre by ESQ), sunk so only a flat cap shows, a dark rim round each
// and a dark upper lid line; the near one (+X) and its mirror
E = [5.1, -12.2, 1.1];
ES = 1.8;
EYAW = 22;
ESQ = [1.2, 1, 0.8];
faceFrame() mirror_x() translate(E) scale(ESQ) translate(-E) {
  eye(E, ES, iris = iris, sclera = sclera, yaw = EYAW, pupil = pupil, flat = 0.38);
  translate(E) rotate([0, 0, EYAW]) color(ink) translate([0, 0.2, 0.06 * ES]) scale([1.12, 0.4, 1.3]) sphere(ES, $fn = 20);
}

// ---- the two chunky quartz clusters on top (ears): a few fat hexagonal prisms with blunt points, leaning outwards
mirror_x() {
  crystal([6.2, 0.8, 30.2], [1.8, 0, 7], 2.1, quartz);
  crystal([8.8, 0.2, 28.8], [2.8, -0.4, 4.2], 1.6, quartzShade);
  crystal([5, -1.6, 30.2], [0.3, -1.2, 4.6], 1.4, quartzShade);
}

// ---- the far arm (-X): reaching forward-left, a short pebbled rock arm and a big pebble fist
FARM = [[3.2, 3.2, 3.2], [-13.6, -5.6, 19.4]];
FIST = [[4.2, 4, 4.1], [-17.6, -8.6, 18.6]];
module pebbled(e, dirs, seed, cA, cB) {
  ell(e[0], e[1], rock);
  for (k = [0 : len(dirs) - 1]) {
    u = dirs[k] / norm(dirs[k]);
    peb(e[1] + [e[0][0] * u[0], e[0][1] * u[1], e[0][2] * u[2]] * 0.98, u, 1.4 + 0.5 * hsh(k + seed), 1.1 + 0.5 * hsh(k + seed + 50),
        hsh(k + seed + 90) * 180, k % 2 ? cA : cB);
  }
}
pebbled(FARM, [[-0.3, -0.6, 0.75], [-0.4, -0.8, -0.4], [-0.5, 0.3, -0.8]], 200, peb2, peb1);
pebbled(FIST, [[-0.7, -0.5, 0.5], [-0.95, 0.1, 0.1], [-0.5, -0.8, -0.3], [0.1, -0.9, 0.4], [-0.6, -0.2, -0.75],
               [-0.2, -0.4, 0.9], [0.4, -0.85, -0.3], [-0.6, 0.6, 0.4]], 300, peb3, peb1);

// ---- the near arm (+X): a pebbled rock arm hanging by the side, a pale crystal hand below with crystal fingers
NARM = [[3.4, 3.3, 3.4], [16.4, -2, 15]];
HAND = [[2.5, 2.4, 2.3], [18.2, -3.4, 10.6]];
pebbled(NARM, [[0.8, -0.4, 0.4], [0.2, -0.9, 0.3], [0.9, 0.2, -0.2], [0.4, -0.1, 0.9], [0.5, 0.7, 0.3], [0.1, -0.6, 0.8]], 650, peb2, peb3);
ell(HAND[0], HAND[1], pale);
crystal(HAND[1], [0.4, -2.4, -4.6], 1.15, quartz);
crystal(HAND[1], [2.8, -0.8, -4.3], 1.1, quartzShade);
crystal(HAND[1], [-1.8, -1.6, -4.3], 1.05, quartz);
crystal(HAND[1], [1.4, 1.6, -4.4], 1.0, quartzShade);
crystal(HAND[1], [2.8, -1.8, 1.4], 0.9, quartz);

// ---- the legs: squat heaps of pale pebbles, a few short crystal toes in front, reaching up into the boulder
FOOT_LUMPS = [[3, -1.8, 2.6, 2.4], [-2.8, -1.6, 2.8, 2.3], [0.2, -3.2, 2.4, 2.1], [2.6, 2.2, 2.8, 2.2], [-2.4, 2.4, 3, 2.1],
              [1, -1, 5.2, 2.8], [-1, 0.8, 5.8, 2.8], [0, 0.2, 8, 3.4]];
module foot(at, out) {
  color(pale) translate(at + [0, 0, 2.4]) scale([4.8, 4.4, 2.4]) sphere(1, $fn = 16);
  for (k = [0 : len(FOOT_LUMPS) - 1]) {
    L = FOOT_LUMPS[k];
    color(k % 2 ? pale : paleHi) translate(at + [L[0] * out, L[1], L[2]]) scale([L[3], L[3] * 0.95, L[3] * 0.85]) sphere(1, $fn = 12);
  }
  crystal(at + [1.8 * out, -3.6, 1.6], [0.6 * out, -1.8, -0.6], 1.1, quartz);
  crystal(at + [-1.6 * out, -3.4, 1.6], [-0.6 * out, -1.8, -0.6], 1, quartzShade);
  crystal(at + [3.8 * out, -1.4, 1.6], [1.8 * out, -0.6, -0.6], 1, quartz);
}
foot([7, -2.8, 0], 1);
foot([-8.8, 2.8, 0], -1);
