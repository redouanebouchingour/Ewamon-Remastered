// Thornback: a huge hunched bark bear under a shaggy mantle of hanging leaves, big branching antlers, a fierce bear
// head turned to its right with a pale muzzle and a red slit eye, many pale thorns on its thick clawed arms, shoulders
// and legs, and a glowing amber heart-stone set in its chest and in the mantle on its back.
//
// Checklist (front sheet, scad = sheet units, creature faces -Y):
// - head: big round brown bear head, sheet x -9..3, z 24..33, turned to the viewer's left, muzzle down-left
// - muzzle: pale cream, sheet -8.2..-3.3, z 24.8..27.9; big dark nose at its tip (-7.5, 26.5); dark mouth line under
// - eyes: a red slanted slit (-3.6, 27..29) just behind the muzzle, a heavy brow; the far eye hidden by the muzzle
// - crown: a tuft of light leaves between the antlers (-6.8..-1.2, 30..35)
// - antlers: thick brown, bases at (-6, 31) / (1.5, 30), six tines each, spread to x -16.6 / 12.5, tops z 40
// - mantle: hanging leaf shingles over the shoulders (green right of the head 0..12, z 19..31; far side -14..-4),
//   a green collar under the heart-stone (-7..3, 13..16); back: the whole back is leaves z 8..32, dark green under
// - heart-stone: amber egg (-6.4..-2, 15.6..21.8), pale highlight upper left, dark rim; back: glowing on the mantle
// - arms: thick bark, far paw out at (-15.5, 11) with claws to x -18.5, near forearm across (5..17, 6..19), its paw
//   in front of the belly (2..8, 8.5..11.5) with pale claws; pale thorns all over both forearms
// - shoulders: brown bark pads with big thorns poking out of the mantle (near 12..15, 27..30; back view both sides)
// - legs: short thick trunks, far foot (-16..-6, 1..7) splayed out, near foot (3..13, 0..5), 4 pale claws each
include <lib.scad>

bark = [0.36, 0.22, 0.12];
barkDk = [0.2, 0.13, 0.08];
barkHi = [0.52, 0.33, 0.18];
antlerC = [0.44, 0.28, 0.15];
leaf = [0.31, 0.5, 0.19];
leafHi = [0.45, 0.63, 0.21];
leafDk = [0.1, 0.25, 0.12];
thorn = [0.93, 0.8, 0.62];
muzzle = [0.93, 0.83, 0.68];
amber = [0.93, 0.66, 0.05, GLOW];
amberCore = [1, 0.93, 0.5, GLOW];
amberRim = [0.62, 0.3, 0.05];
dark = [0.07, 0.05, 0.04];
red = [0.88, 0.13, 0.1, NOGLOW];

// Ellipsoid with its own facet count (lib ell() is fixed at 28).
module e(r, p, c, fn = 16) color(c) translate(p) scale(r) sphere(1, $fn = fn);
// A hanging leaf, authored pointing down (-Z), wide along X, thin along Y; turned to face azimuth `a` (0 = -Y, the
// front; 90 = +X) and flared out by `flare` degrees.
module leafHang(p, a, len, w, c, flare = 18, th = 0.45, roll = 0) color(c) translate(p) rotate([0, 0, a]) rotate([-flare, roll, 0]) hull() {
  scale([w * 0.3, th, 0.3]) sphere(1, $fn = 6);
  translate([0, 0, -len * 0.4]) scale([w / 2, th, len * 0.3]) sphere(1, $fn = 8);
  translate([0, 0, -len]) sphere(0.12, $fn = 4);
}
// The same leaf pointing up (crown tuft, rosettes).
module leafUp(p, rot, len, w, c) color(c) translate(p) rotate(rot) hull() {
  scale([w * 0.3, 0.4, 0.3]) sphere(1, $fn = 6);
  translate([0, 0, len * 0.45]) scale([w / 2, 0.4, len * 0.34]) sphere(1, $fn = 8);
  translate([0, 0, len]) sphere(0.12, $fn = 4);
}
// A ring of hanging leaves round an ellipse (rx, ry) centred at y0, from azimuth a0 to a1.
module leafRow(z, rx, ry, y0, a0, a1, n, len, w, cs, flare = 18) for (i = [0 : n - 1]) {
  a = a0 + (a1 - a0) * (n == 1 ? 0.5 : i / (n - 1)) + 4 * sin(i * 137 + z * 31);
  j = sin(i * 71 + z * 13);
  leafHang([rx * sin(a), y0 - ry * cos(a), z + 0.8 * j], a, len * (1 + 0.12 * j), w, cs[i % len(cs)], flare + 6 * j,
           roll = 14 * sin(i * 97 + z * 7));
}
// Pale thorns round a limb from p1 to p2: list of [t along it, angle round it (0 = outwards), length, base radius].
function _n(v) = v / norm(v);
module thornsOn(p1, p2, r, list) {
  u = _n(p2 - p1);
  v1 = _n(cross(u, [0, 0, 1]));
  v2 = cross(v1, u);
  for (t = list) {
    rad = cos(t[1]) * v1 + sin(t[1]) * v2;
    spike(p1 + (p2 - p1) * t[0] + rad * r * 0.8, _n(rad + [0, 0, 0.45]) * t[2], t[3], 0.06, thorn);
  }
}

// Lighter bark knots on a limb: list of [t, angle, radius].
module bumpsOn(p1, p2, r, list) {
  u = _n(p2 - p1);
  v1 = _n(cross(u, [0, 0, 1]));
  v2 = cross(v1, u);
  for (t = list) e([t[2], t[2], t[2]], p1 + (p2 - p1) * t[0] + (cos(t[1]) * v1 + sin(t[1]) * v2) * (r - 0.4), barkHi, 10);
}

// ---- Torso: a massive hunched barrel of bark, dark below.
blob([[[12.6, 9.5, 8], [0, 1, 12.5]], [[12.8, 9, 7.5], [0, 0.5, 21]]], bark);
blob([[[9, 8, 4.5], [0, 0.5, 8.5]], [[6, 6, 3], [0, 0, 6]]], barkDk);

// ---- Heart-stone in the chest: amber egg in a dark rim, a pale highlight upper left.
HS = [0.5, -9.8, 18.7];
e([2.9, 1.3, 3.7], HS, amberRim);
e([2.35, 1.4, 3.1], HS + [0, -0.6, 0], amber);
e([0.95, 0.6, 1.4], HS + [-0.7, -1.8, 0.8], amberCore);
// Leaf collar under it.
for (k = [-2 : 2]) leafHang([HS[0] + k * 1.9, -9.9 + abs(k) * 0.5, 15.9], k * 14, 3.6, 2.2, k % 2 == 0 ? leaf : leafHi, 14);

// ---- Mantle: a leafy hump over the shoulders, shingled leaves hanging in rows round it and down the back.
blob([[[12.8, 10, 5], [0, 1.5, 25]], [[8.5, 7.5, 3.5], [0, 2, 29]], [[11.5, 10.2, 4], [0, 2.5, 17]]], leafDk);
e([13.6, 10.2, 5.6], [0, 0.4, 22.6], leafDk, 26);
leafRow(32.2, 7, 6.5, 2.5, 0, 330, 12, 4.6, 3.8, [leafHi, leaf]);
leafRow(29.6, 11, 9, 2, -110, 110, 10, 5.2, 4.4, [leaf, leafHi, leaf], 24);
leafRow(29.6, 11, 9, 2, 128, 232, 5, 5.2, 4.4, [leaf, leafHi]);
leafRow(26.2, 13.4, 10.6, 1.5, 32, 328, 13, 5.6, 4.6, [leaf, leafDk, leafHi], 22);
leafRow(22.2, 13.8, 11, 1.8, 24, 336, 15, 5.6, 4.6, [leafHi, leaf, leafDk], 22);
leafRow(18.2, 13.2, 11.2, 2.2, 62, 298, 11, 5.6, 4.6, [leaf, leafDk, leafHi]);
leafRow(14.2, 12.8, 11.2, 2.5, 80, 280, 10, 5.4, 4.4, [leafDk, leaf]);
leafRow(10.6, 12, 11, 2.8, 95, 265, 9, 4.6, 4.2, [leaf, leafDk]);
// Leaves hanging off the belly between the legs.
leafRow(13.4, 9.5, 9, 0.5, -55, 25, 4, 4.6, 3.2, [leafDk, leaf, leafDk, leaf], 10);
// Back heart-stone, set in the mantle between the shoulder blades.
BS = [0, 13.6, 20.5];
e([2.8, 1.2, 3.4], BS, amberRim);
e([2.2, 1.3, 2.8], BS + [0, 0.6, 0], amber);
e([1, 0.6, 1.3], BS + [0, 1.6, 0.4], amberCore);

// ---- Shoulder pads of bark with big thorns poking out of the mantle.
mirror_x() {
  e([4.2, 4.6, 3.4], [10.5, 2.5, 25], bark);
  spike([12.5, 0.5, 27], [1.6, -1.2, 3.2], 1.3, 0.07, thorn);
  spike([11.8, 5, 27.5], [1.4, 1.4, 3.2], 1.2, 0.07, thorn);
  spike([14, 2.5, 24.5], [3, 0.2, 1.6], 1.1, 0.07, thorn);
}

// ---- Head: big and round, turned to its right and nodding, a pale muzzle with a big dark nose, a red slit eye
// under a heavy brow.
HD = [1.5, -7.5, 28];
translate(HD) rotate([14, 0, -22]) {
  e([5.9, 5.4, 5], [0, 0, 0], bark, 24);
  e([6.1, 4.9, 3.8], [0, -0.6, -1.5], bark, 22);
  // muzzle, nose, jaw, mouth line
  blob([[[3.1, 2.6, 2.2], [0, -4.6, -1.6]], [[2.7, 1.8, 2], [0, -6.5, -1.4]]], muzzle);
  e([1.6, 1, 1.2], [0, -8, -0.6], dark);
  e([2.7, 3.2, 1.3], [0, -4.9, -3.8], barkHi);
  e([2.5, 2.9, 0.3], [0, -5.4, -3.1], dark);
  mirror_x() {
    eye([2.9, -4.35, 1.4], 1.2, iris = red, sclera = red, pupil = dark, yaw = 18, flat = 0.5,
        lid = 0.42, lid_tilt = 34, lid_c = bark, slit = 0.3, shine = false);
    // heavy brow slanting down to the nose
    color(barkDk) hull() {
      translate([4.1, -3.7, 2.9]) scale([1.5, 1.1, 0.8]) sphere(1, $fn = 10);
      translate([1.2, -5, 2.2]) scale([1, 0.8, 0.6]) sphere(1, $fn = 10);
    }
    // small round ear
    e([1.8, 1.1, 1.8], [5, 1, 3.6], bark);
    e([1, 0.5, 1], [5.1, 0.1, 3.6], barkDk);
  }
}
// Crown tuft of light leaves.
for (l = [[-28, 0, leafHi], [0, 0, leaf], [26, 0, leafHi], [-8, 30, leaf]])
  leafUp(HD + [0, 1.5, 4], [-12 + l[1] * -0.4, l[0], 0], 5, 3.2, l[2]);

// ---- Antlers: thick branching boughs off the crown, spreading out and up, six tines each.
module antler(s) {
  B = HD + [s * 3.6, 1.8, 3.6];
  function at(v) = B + [s * v[0], v[1], v[2]];
  p1 = at([3.2, 0.5, 2.9]); p2 = at([7, 1, 5.2]); q = at([9.8, 1.3, 6.4]); p3 = at([12.4, 1.6, 8.3]);
  chain([B, p1, p2, q, p3], [1.8, 1.45, 1.15, 0.9, 0.5], antlerC);
  limb(p1, at([2.4, 0.2, 8]), 1, 0.45, antlerC);         // brow tine, up
  limb(at([1, 0.2, 1]), at([-0.6, -0.6, 5.2]), 0.8, 0.4, antlerC);   // short inner tine
  limb(p2, at([5.6, 0.6, 8.4]), 0.95, 0.45, antlerC);    // tall middle tine
  limb(q, at([9.4, 1.2, 8.6]), 0.75, 0.4, antlerC);
  limb(q, at([14.2, 1.8, 4.6]), 0.75, 0.4, antlerC);     // outer tine, out and down
}
antler(1);
antler(-1);

// ---- Arms: thick bark, the paws hanging forward with four pale claws, the forearms studded with pale thorns.
SH = [12.5, 0.5, 22]; EL = [16, 1, 12.5]; WR = [12.5, -6.5, 10.5];
mirror_x() {
  limb(SH, EL, 4.4, 4.3, bark);
  limb(EL, WR, 4.3, 3.6, bark);
  e([3.5, 3.8, 2.8], [12.3, -8.6, 9], barkDk);
  for (o = [-1.8, -0.6, 0.6, 1.8]) spike([12.3 + o, -11.4, 8.6], [-0.35 + o * 0.15, -1.9, -1.4], 0.72, 0.05, thorn);
  thornsOn(EL, WR, 4.1, [[0.1, 10, 3.4, 1.25], [0.15, 75, 3, 1.15], [0.38, -25, 3.2, 1.2], [0.42, 40, 3.4, 1.25],
                         [0.68, 10, 2.8, 1.05], [0.7, 75, 2.8, 1], [0.35, 120, 2.6, 1], [0.88, 45, 2.4, 0.9],
                         [0.6, -70, 2.6, 1], [0.2, -60, 2.8, 1.05]]);
  thornsOn(SH, EL, 4.4, [[0.5, 0, 3, 1.15], [0.8, -40, 2.8, 1.05], [0.72, 45, 2.8, 1.05], [0.35, -70, 2.6, 1]]);
  // lighter bark knots on the forearm and leaves hanging off the shoulder over the upper arm
  bumpsOn(EL, WR, 4.1, [[0.25, 30, 1.5], [0.55, -40, 1.4], [0.55, 95, 1.3], [0.8, 20, 1.2]]);
  for (l = [[-40, leafHi], [-8, leaf], [26, leafHi], [60, leaf], [95, leafDk]])
    leafHang([SH[0] + 4.5 * sin(l[0]), SH[1] - 4.5 * cos(l[0]), 26], l[0], 6.2, 4.2, l[1], 22);
}

// ---- Legs: short thick trunks, the feet splayed out with four pale claws.
mirror_x() {
  e([5, 5.5, 5.2], [10, -0.5, 6.5], bark, 22);
  translate([10.8, -2.5, 0]) rotate([0, 0, 20]) {
    blob([[[3.9, 4.6, 2], [0, -1, 2]], [[3.4, 3.4, 2.2], [0, 1.5, 2.4]]], barkDk);
    for (o = [-2.1, -0.7, 0.7, 2.1]) spike([o, -5.2, 1.4], [o * 0.15, -1.6, -0.7], 0.65, 0.05, thorn);
  }
  spike([14, -1.5, 8.5], [1.6, -0.8, 2.4], 0.95, 0.06, thorn);
  spike([12.5, -4.5, 5], [0.8, -1.8, 1.8], 0.85, 0.06, thorn);
}
