// Thornback Tenjin: the ascended Thornback. Dark bark cracked with gold veins, a pale sage mantle of feathery leaves
// that runs down the back into a long leafy train sweeping out to its left, big golden thorns and claws, antlers
// hung with white blossoms, a golden halo with a pale gem behind the head, a calm bear face with pale eyes and a tan
// muzzle, and a glowing gold heart-stone set in a rosette of leaves on its chest and its back.
//
// Checklist (front sheet, scad = sheet units, creature faces -Y):
// - head: smaller than the base's and lower, sheet x -9.9..-1, z 21.6..29, face midline at -6.5 (a slight turn left)
// - eyes: two small pale almond eyes under heavy brows, far (-8.8..-8.1, 25.1..25.8), near (-5.1..-3.9, 25..25.6)
// - muzzle: tan (-8.6..-4.4, 22.1..25.3), dark nose at its tip (-8.6..-6.8, 23.5..24.2), mouth line under
// - ears: round, gold inside, near (-2.7..-1, 26.2..28.5); a pale leaf tuft on the crown (-7.5..-1.5, 26..31)
// - gold veins: a crack network over the face, chest, arms and legs
// - antlers: from (-6, 29) / (0, 29), tips up to z 39.7, white five-petal blossoms on the tips
// - halo: gold ring centred (-2.5, 31), radius 5.5, a pale gem in a gold setting at its top (-3, 35.8)
// - mantle: pale sage leaves over the shoulders and the chest sides; the back is one long train of leaves from the
//   shoulders to the ground, sweeping out to the near side (front: 10..19, z 2..15)
// - heart-stone: glowing gold drop (-5.5..-2, 15.5..21) in a rosette of pale leaves (-8..1, 13..22); the back the same
// - arms, legs and pose as Thornback; big gold thorns on the shoulders (near 7..10, 24..28), forearms and legs
include <lib.scad>

bark = [0.3, 0.2, 0.1];
barkDk = [0.17, 0.11, 0.05];
barkHi = [0.46, 0.32, 0.16];
antlerC = [0.36, 0.24, 0.12];
leaf = [0.74, 0.75, 0.51];
leafHi = [0.93, 0.9, 0.66];
leafDk = [0.56, 0.58, 0.4];
thorn = [0.94, 0.78, 0.38, NOGLOW];
gold = [0.93, 0.77, 0.25];
muzzle = [0.74, 0.55, 0.4];
amber = [1, 0.8, 0.12, GLOW];
amberCore = [1, 0.97, 0.62, GLOW];
blossom = [0.99, 0.97, 0.89, NOGLOW];
haloGem = [0.62, 0.68, 0.56];
dark = [0.07, 0.05, 0.04];
eyeC = [0.99, 0.95, 0.78, GLOW];

// Ellipsoid with its own facet count (lib ell() is fixed at 28).
module e(r, p, c, fn = 16) color(c) translate(p) scale(r) sphere(1, $fn = fn);
// blob() with fewer facets on its ellipsoids (big smooth hulls).
module blobN(parts, c, fn = 20) color(c) hull() for (q = parts) translate(q[1]) scale(q[0]) sphere(1, $fn = fn);
// A hanging leaf, authored pointing down (-Z), wide along X, thin along Y; turned to face azimuth `a` (0 = -Y, the
// front; 90 = +X) and flared out by `flare` degrees.
module leafHang(p, a, len, w, c, flare = 18, th = 0.45, roll = 0) color(c) translate(p) rotate([0, 0, a]) rotate([-flare, roll, 0]) hull() {
  scale([w * 0.3, th, 0.3]) sphere(1, $fn = 6);
  translate([0, 0, -len * 0.4]) scale([w / 2, th, len * 0.3]) sphere(1, $fn = 6);
  translate([0, 0, -len]) sphere(0.12, $fn = 4);
}
// The same leaf pointing up (crown tuft, rosettes).
module leafUp(p, rot, len, w, c, th = 0.4) color(c) translate(p) rotate(rot) hull() {
  scale([w * 0.3, th, 0.3]) sphere(1, $fn = 6);
  translate([0, 0, len * 0.45]) scale([w / 2, th, len * 0.34]) sphere(1, $fn = 6);
  translate([0, 0, len]) sphere(0.12, $fn = 4);
}
// A ring of hanging leaves round an ellipse (rx, ry) centred at y0, from azimuth a0 to a1.
module leafRow(z, rx, ry, y0, a0, a1, n, len, w, cs, flare = 18) for (i = [0 : n - 1]) {
  a = a0 + (a1 - a0) * (n == 1 ? 0.5 : i / (n - 1)) + 4 * sin(i * 137 + z * 31);
  j = sin(i * 71 + z * 13);
  leafHang([rx * sin(a), y0 - ry * cos(a), z + 0.8 * j], a, len * (1 + 0.12 * j), w, cs[i % len(cs)], flare + 6 * j,
           roll = 14 * sin(i * 97 + z * 7));
}
// Gold thorns round a limb from p1 to p2: list of [t along it, angle round it (0 = outwards), length, base radius].
function _n(v) = v / norm(v);
// A cone like lib spike(), with fewer facets.
module spike8(p, d, r, tip = 0.05, c) color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = r, r2 = tip, $fn = 8);
module thornsOn(p1, p2, r, list) {
  u = _n(p2 - p1);
  v1 = _n(cross(u, [0, 0, 1]));
  v2 = cross(v1, u);
  for (t = list) {
    rad = cos(t[1]) * v1 + sin(t[1]) * v2;
    spike8(p1 + (p2 - p1) * t[0] + rad * r * 0.8, _n(rad + [0, 0, 0.45]) * t[2], t[3], 0.06, thorn);
  }
}
// A gold vein along a limb's surface: points [t, angle] (radius r1 at p1 to r2 at p2).
module veinOn(p1, p2, r1, r2, pts) {
  u = _n(p2 - p1);
  v1 = _n(cross(u, [0, 0, 1]));
  v2 = cross(v1, u);
  function P(q) = p1 + (p2 - p1) * q[0] + (cos(q[1]) * v1 + sin(q[1]) * v2) * (r1 + (r2 - r1) * q[0] + 0.03);
  for (i = [0 : len(pts) - 2]) limb(P(pts[i]), P(pts[i + 1]), 0.2, 0.2, gold);
}
// A gold vein over an ellipsoid (r, c): points [azimuth from the front towards +X, elevation].
function ellPt(r, c, q) = c + [r[0] * sin(q[0]) * cos(q[1]), -r[1] * cos(q[0]) * cos(q[1]), r[2] * sin(q[1])] * 1.01;
module veinEll(r, c, pts, w = 0.2) for (i = [0 : len(pts) - 2]) limb(ellPt(r, c, pts[i]), ellPt(r, c, pts[i + 1]), w, w, gold);
// A five-petal blossom facing out along -Y, gold at the heart.
module flower(p) {
  for (k = [0 : 4]) color(blossom) translate(p + [cos(k * 72 + 18) * 0.75, 0, sin(k * 72 + 18) * 0.75]) scale([0.6, 0.35, 0.6]) sphere(1, $fn = 6);
  color(gold) translate(p + [0, -0.3, 0]) sphere(0.32, $fn = 6);
}
// A rosette of pale leaves round a stone at p, in the plane facing -Y (or +Y with back).
module rosette(p, back = false) translate(p) rotate([0, 0, back ? 180 : 0])
  for (k = [0 : 7]) leafUp([0, 0.3, 0], [0, k * 45 + 22.5, 0], 4.8, 3, k % 2 == 0 ? leaf : leafHi, 0.35);

// ---- Torso: a massive hunched barrel of bark, dark below, cracked with gold.
blobN([[[12.6, 9.5, 8], [0, 1, 12.5]], [[12.8, 9, 7.5], [0, 0.5, 21]]], bark);
blobN([[[9, 8, 4.5], [0, 0.5, 8.5]], [[6, 6, 3], [0, 0, 6]]], barkDk);
TR = [12.6, 9.5, 8]; TC = [0, 1, 12.5];
veinEll(TR, TC, [[-38, 25], [-30, 12], [-36, 2], [-28, -10]]);
veinEll(TR, TC, [[-30, 12], [-18, 8], [-12, -4]]);
veinEll(TR, TC, [[28, 30], [22, 16], [30, 6], [24, -8]]);
veinEll(TR, TC, [[22, 16], [10, 10]]);

// ---- Heart-stone in the chest: a glowing gold drop in a rosette of pale leaves.
HS = [0.5, -9.8, 17.9];
rosette(HS + [0, -0.7, 0]);
color(amber) translate(HS + [0, -1.1, 0]) hull() {
  scale([2.2, 1.3, 2.5]) sphere(1, $fn = 16);
  translate([0, 0, 3.1]) sphere(0.3, $fn = 8);
  translate([0, 0, -2.8]) sphere(0.3, $fn = 8);
}
e([1, 0.6, 1.4], HS + [-0.3, -2.15, 0.3], amberCore);

// ---- Mantle: a pale leafy hump over the shoulders, shingled leaves hanging round it.
blobN([[[12.8, 10, 5], [0, 1.5, 25]], [[8.5, 7.5, 3.5], [0, 2, 29]], [[11.5, 10.2, 4], [0, 2.5, 17]]], leafDk);
e([13.6, 10.2, 5.6], [0, 0.4, 22.6], leafDk, 20);
leafRow(30.8, 7, 6.5, 2.5, 30, 330, 10, 4.6, 3.8, [leafHi, leaf]);
leafRow(29, 11, 9, 2, -110, 110, 9, 5.2, 4.4, [leaf, leafHi, leaf], 24);
leafRow(29, 11, 9, 2, 128, 232, 5, 5.2, 4.4, [leafHi, leaf]);
leafRow(26.2, 13.4, 10.6, 1.5, 32, 328, 11, 5.6, 4.6, [leaf, leafDk, leafHi], 22);
leafRow(22.2, 13.8, 11, 1.8, 24, 336, 12, 5.6, 4.6, [leafHi, leaf, leafDk], 22);
// Leaves hanging off the belly between the legs.
leafRow(13.4, 9.5, 9, 0.5, -45, 15, 3, 4.6, 3.2, [leafDk, leaf, leafDk], 10);

// ---- The train: long feathery leaves from the shoulders to the ground down the back, sweeping out to its left.
blobN([[[9, 3, 5], [0, 10.5, 19]], [[9.5, 3.2, 4], [2.5, 11.2, 10]], [[6, 3, 2.5], [9, 10, 4]], [[2.5, 2, 1.5], [15, 6, 2]]], leafDk);
leafRow(19.5, 12.4, 11.2, 2.2, 80, 280, 9, 9, 5, [leaf, leafHi, leafDk], 8);
// lower layer, its leaves swinging out to the near side
for (i = [0 : 6]) {
  a = 110 + i * 22;
  leafHang([10.8 * sin(a) + 1.1 * (6 - i), 2.6 - 11.2 * cos(a), 11.5], a - 12, 9, 5, [leafHi, leaf, leafDk][i % 3], 12,
           roll = -12 - 3 * (6 - i));
}
// the train's tip sweeping out and down to the near side
for (t = [[12, 9, 11, 112, leaf], [14.5, 7, 8, 104, leafHi], [16.5, 5, 5.5, 98, leaf]])
  leafHang([t[0], t[1], t[2]], t[3], 8, 5, t[4], 34, roll = -28);
// Back heart-stone, set in its own rosette between the shoulder blades.
BS = [0, 14, 20.5];
rosette(BS, back = true);
color(amber) translate(BS + [0, 0.6, 0]) hull() {
  scale([1.8, 1.1, 2.1]) sphere(1, $fn = 16);
  translate([0, 0, 2.4]) sphere(0.3, $fn = 8);
  translate([0, 0, -2.2]) sphere(0.3, $fn = 8);
}
e([0.8, 0.5, 1.1], BS + [0, 1.5, 0.3], amberCore);

// ---- Shoulder pads of bark with big gold thorns poking out of the mantle.
mirror_x() {
  e([4.2, 4.6, 3.4], [10.5, 2.5, 25], bark);
  spike8([12.5, 0.5, 27], [1.9, -1.4, 3.9], 1.5, 0.07, thorn);
  spike8([11.8, 5, 27.5], [1.7, 1.7, 3.9], 1.4, 0.07, thorn);
  spike8([14, 2.5, 24.5], [3.4, 0.2, 1.8], 1.2, 0.07, thorn);
}

// ---- Head: a little smaller, turned slightly to its right, calm pale eyes under heavy brows, a tan muzzle.
HD = [0.5, -9.6, 25.5];
translate(HD) rotate([10, 0, -6]) {
  e([4.8, 4.5, 4.2], [0, 0, 0], bark, 20);
  e([5, 4.1, 3.2], [0, -0.5, -1.3], bark, 20);
  // muzzle, nose, jaw, mouth line
  blob([[[2.5, 2, 1.8], [0, -3.8, -1.4]], [[2.1, 1.5, 1.5], [0, -5.5, -1.2]]], muzzle);
  e([1.15, 0.7, 0.8], [0, -6.8, -0.6], dark);
  e([2.2, 2.6, 1], [0, -4, -3.1], barkHi);
  e([2, 2.4, 0.25], [0, -4.4, -2.5], dark);
  mirror_x() {
    eye([2.1, -3.6, 1], 0.9, iris = eyeC, sclera = eyeC, pupil = eyeC, yaw = 16, flat = 0.5,
        lid = 0.36, lid_tilt = 22, lid_c = bark, shine = false);
    // heavy brow slanting down to the nose
    color(barkDk) hull() {
      translate([3.1, -3.1, 2.1]) scale([1.2, 0.9, 0.6]) sphere(1, $fn = 10);
      translate([0.9, -4, 1.6]) scale([0.8, 0.7, 0.5]) sphere(1, $fn = 10);
    }
    // round ear, gold inside
    e([1.6, 1, 1.6], [3.9, 0.8, 3], bark);
    e([0.85, 0.45, 0.85], [4, 0, 3], gold);
  }
  // gold veins over the brow and cheek
  veinEll([4.8, 4.5, 4.2], [0, 0, 0], [[-8, 52], [-14, 40], [-6, 30]], 0.15);
  veinEll([4.8, 4.5, 4.2], [0, 0, 0], [[30, 46], [36, 32], [44, 26]], 0.15);
  veinEll([5, 4.1, 3.2], [0, -0.5, -1.3], [[48, 10], [40, -6], [50, -20]], 0.15);
}
// Crown tuft of pale leaves.
for (l = [[-28, 0, leafHi], [0, 0, leaf], [26, 0, leafHi], [-8, 30, leaf]])
  leafUp(HD + [0, 1.5, 3.2], [-12 + l[1] * -0.4, l[0], 0], 4.6, 3, l[2]);

// ---- Antlers: branching boughs off the crown, taller than the base's, with white blossoms on the tines.
module antler(s) {
  B = HD + [s * 2.8, 3, 2.6];
  function at(v) = B + [s * v[0] * 0.85, v[1], v[2] * 1.3];
  p1 = at([3.2, 0.5, 2.9]); p2 = at([7, 1, 5.2]); q = at([9.8, 1.3, 6.4]); p3 = at([12.4, 1.6, 8.3]);
  chain([B, p1, p2, q, p3], [1.25, 1.1, 0.95, 0.75, 0.45], antlerC);
  limb(p1, at([2.4, 0.2, 8]), 0.9, 0.4, antlerC);        // brow tine, up
  limb(at([1, 0.2, 1]), at([-0.6, -0.6, 5.2]), 0.7, 0.35, antlerC);   // short inner tine
  limb(p2, at([5.6, 0.6, 8.4]), 0.85, 0.4, antlerC);     // tall middle tine
  limb(q, at([9.4, 1.2, 8.6]), 0.7, 0.35, antlerC);
  limb(q, at([14.2, 1.8, 4.6]), 0.7, 0.35, antlerC);     // outer tine, out and down
  for (v = [[12.4, 1.6, 8.3], [2.4, 0.2, 8], [5.6, 0.6, 8.4], [9.4, 1.2, 8.6], [14.2, 1.8, 4.6]])
    flower(at(v) + [0, -0.5, 0.3]);
}
antler(1);
antler(-1);

// ---- Halo: a golden ring behind the head in the picture plane, a pale gem in a gold setting at its top.
HC = [-1, -4.5, 31.2];
color(gold) translate(HC) rotate([0, 0, 30]) rotate([90, 0, 0]) rotate_extrude($fn = 32) translate([5.2, 0]) circle(0.6, $fn = 6);
color(gold) translate(HC + [0, 0, 5.4]) rotate([0, 0, 30]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 1.25, center = true, $fn = 8);
color(haloGem) translate(HC + [-0.25, -0.43, 5.4]) rotate([0, 0, 30]) scale([0.85, 0.5, 0.85]) sphere(1, $fn = 12);

// ---- Arms: thick bark cracked with gold, the paws hanging forward with four gold claws, gold thorns.
SH = [12.5, 0.5, 22]; EL = [16, 1, 12.5]; WR = [12.5, -6.5, 10.5];
mirror_x() {
  limb(SH, EL, 4.4, 4.3, bark);
  limb(EL, WR, 4.3, 3.6, bark);
  e([3.5, 3.8, 2.8], [12.3, -8.6, 9], barkDk);
  for (o = [-1.8, -0.6, 0.6, 1.8]) spike8([12.3 + o, -11.4, 8.6], [-0.35 + o * 0.15, -1.9, -1.4], 0.72, 0.05, thorn);
  thornsOn(EL, WR, 4.1, [[0.1, 10, 3.4, 1.25], [0.15, 75, 3, 1.15], [0.38, -25, 3.2, 1.2], [0.42, 40, 3.4, 1.25],
                         [0.68, 10, 2.8, 1.05], [0.7, 75, 2.8, 1], [0.35, 120, 2.6, 1], [0.88, 45, 2.4, 0.9],
                         [0.6, -70, 2.6, 1], [0.2, -60, 2.8, 1.05]]);
  thornsOn(SH, EL, 4.4, [[0.5, 0, 3, 1.15], [0.8, -40, 2.8, 1.05], [0.72, 45, 2.8, 1.05], [0.35, -70, 2.6, 1]]);
  veinOn(EL, WR, 4.3, 3.6, [[0.05, -100], [0.25, -80], [0.4, -100], [0.6, -85], [0.8, -110], [0.95, -95]]);
  veinOn(EL, WR, 4.3, 3.6, [[0.25, -80], [0.3, -50], [0.5, -30], [0.55, -5]]);
  veinOn(SH, EL, 4.4, 4.3, [[0.3, -100], [0.5, -80], [0.7, -95], [0.9, -75]]);
  veinOn(SH, EL, 4.4, 4.3, [[0.5, -80], [0.6, -50], [0.65, -20]]);
  for (l = [[-40, leafHi], [-8, leaf], [26, leafHi], [60, leaf], [95, leafDk]])
    leafHang([SH[0] + 4.5 * sin(l[0]), SH[1] - 4.5 * cos(l[0]), 26], l[0], 6.2, 4.2, l[1], 22);
}

// ---- Legs: short thick trunks cracked with gold, the feet splayed out with four gold claws.
mirror_x() {
  e([5, 5.5, 5.2], [10, -0.5, 6.5], bark, 18);
  veinEll([5, 5.5, 5.2], [10, -0.5, 6.5], [[-30, 40], [-10, 25], [-25, 5], [-5, -10]]);
  veinEll([5, 5.5, 5.2], [10, -0.5, 6.5], [[-10, 25], [15, 18], [35, 28]]);
  translate([10.8, -2.5, 0]) rotate([0, 0, 20]) {
    blob([[[3.9, 4.6, 2], [0, -1, 2]], [[3.4, 3.4, 2.2], [0, 1.5, 2.4]]], barkDk);
    for (o = [-2.1, -0.7, 0.7, 2.1]) spike8([o, -5.2, 1.4], [o * 0.15, -1.6, -0.7], 0.65, 0.05, thorn);
  }
  spike8([14, -1.5, 8.5], [1.6, -0.8, 2.4], 0.95, 0.06, thorn);
  spike8([12.5, -4.5, 5], [0.8, -1.8, 1.8], 0.85, 0.06, thorn);
}
