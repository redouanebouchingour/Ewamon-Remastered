// Thornback: a huge bark-skinned bear under a shaggy leaf mantle, branching antlers, thorny arms and a glowing amber
// heart-stone set in its chest and back.
include <lib.scad>

bark = [0.42, 0.26, 0.13];
barkDk = [0.28, 0.17, 0.08];
barkHi = [0.56, 0.38, 0.2];
leaf = [0.24, 0.52, 0.16];
leafHi = [0.42, 0.68, 0.22];
leafDk = [0.15, 0.36, 0.1];
thorn = [0.9, 0.8, 0.64];
muzzle = [0.9, 0.84, 0.72];
amber = [0.98, 0.66, 0.08];
amberCore = [1, 0.92, 0.4];
dark = [0.06, 0.05, 0.04];
red = [0.85, 0.12, 0.08];

// Low-poly leaf blade.
module blade(p, rot, s, c) {
  color(c) translate(p) rotate(rot) scale(s) sphere(1, $fn = 10);
}
module stone(p, back = false) {
  translate(p) rotate([back ? 180 : 0, 0, 0]) {
    color(leafHi) scale([5, 1.6, 5.6]) sphere(1, $fn = 20);
    color(barkDk) translate([0, -0.8, 0]) scale([4, 1.6, 4.6]) sphere(1, $fn = 20);
    color(amber) translate([0, -1.6, 0]) scale([3.2, 1.6, 3.9]) sphere(1, $fn = 20);
    color(amberCore) translate([-0.6, -2.9, 0.8]) scale([1.4, 0.7, 1.9]) sphere(1, $fn = 12);
  }
}

// Torso: a massive barrel.
blob([[[13, 10.5, 9], [0, 0.5, 11]], [[13.5, 10, 8.5], [0, 0, 20]]], bark);
// Bark plates on the belly.
for (x = [-5, 5]) ell([3.4, 1.4, 2], [x, -9.8, 10], barkDk);
stone([0, -10.5, 18.5]);
stone([0, 13.5, 20], back = true);

// Leaf mantle: a ring of drooping blades over the shoulders and down the back.
for (i = [0 : 15]) {
  a = i * 360 / 16;
  blade([12 * sin(a), -0.5 - 10 * cos(a), 25], [-55 * cos(a), 55 * sin(a), 0], [3, 1.2, 6], i % 3 == 0 ? leafHi : leaf);
}
for (i = [0 : 9]) {
  a = 90 + i * 180 / 9;
  blade([13 * sin(a), -9.5 * cos(a), 16], [-30 * cos(a), 30 * sin(a), 0], [3, 1.2, 6], i % 2 == 0 ? leaf : leafDk);
}
for (i = [0 : 6]) {
  a = 120 + i * 120 / 6;
  blade([12 * sin(a), -9.8 * cos(a), 9], [-25 * cos(a), 25 * sin(a), 0], [3, 1.2, 5.5], i % 2 == 0 ? leafDk : leaf);
}
// Leaves draping down the chest around the heart-stone.
for (b = [[-6, -9.5, 22, 25], [6, -9.5, 22, -25], [-7.5, -9, 15, 10], [7.5, -9, 15, -10]]) blade([b[0], b[1], b[2]], [20, b[3], 0], [2.4, 1, 5], leafHi);
blob([[[10, 8, 3], [0, 1.5, 27]], [[7, 6, 2], [0, 2, 29.5]]], leaf);

// Head: low and forward under the mane.
blob([[[7.5, 7, 6.5], [0, -5.5, 29.5]], [[6.5, 6, 5], [0, -3, 32.5]]], bark);
// Pale bony muzzle.
blob([[[4.4, 3.4, 3], [0, -11, 27.5]], [[3, 3, 2.3], [0, -13, 28]]], muzzle);
ell([1.4, 0.9, 1], [0, -15.6, 28.5], dark);
color(dark) translate([0, -14.4, 26]) rotate([90, 0, 0]) scale([1.6, 0.35, 0.35]) cylinder(h = 0.6, r = 1, center = true, $fn = 12);
// Glowing red eyes under a heavy brow.
mirror_x() {
  eye([3.6, -11, 31], 1.5, iris = red, sclera = dark, pupil = dark, yaw = -22);
  color(barkDk) translate([3.6, -11.7, 32.6]) rotate([0, -15, -22]) scale([2.2, 0.8, 0.6]) sphere(1, $fn = 12);
}
// Small ears.
mirror_x() ell([2, 1.3, 2], [5.6, -3, 36.5], bark);
// Leaf tuft on the crown.
for (r = [-25, 0, 25]) blade([0, -3, 37.5], [-15, r, 0], [1.2, 0.8, 3], leafHi);

// Branching antlers.
mirror_x() {
  chain([[3.5, -2, 36], [7, -2, 41], [11, -1.5, 45], [14, -1, 49]], [1.6, 1.3, 1, 0.6], barkHi);
  limb([7, -2, 41], [10, -2.5, 40.5], 0.7, 0.4, barkHi);
  limb([11, -1.5, 45], [10, -2, 49.5], 0.6, 0.35, barkHi);
  limb([11, -1.5, 45], [15, -1.5, 45], 0.6, 0.35, barkHi);
  limb([13, -1.2, 47.5], [16.5, -1, 49.5], 0.45, 0.3, barkHi);
  limb([5, -2, 38.5], [3.5, -2.5, 42], 0.6, 0.35, barkHi);
}

// Arms: thick and long, studded with pale thorns, ending in clawed paws.
mirror_x() {
  limb([13, -1, 21], [16, -3, 9], 4.6, 4.2, bark);
  ell([4.4, 4.4, 3.4], [16.2, -4, 5.5], barkDk);
  for (t = [[17.5, -5.5, 17, 1, -1.5, 1.5], [18.5, -1, 14, 2, 0, 1], [17, -6.5, 11, 0.8, -1.8, 0.4], [19.5, -3, 9, 2, -0.8, 0.3], [16, 2, 18, 1, 1.5, 1.5], [14.5, -5, 21, 0.5, -1.5, 1.8]])
    spike([t[0], t[1], t[2]], [t[3], t[4], t[5]] * 2.4, 1.5, 0.1, thorn);
  for (a = [-35, 0, 35]) spike([16.2 + sin(a) * 2.5, -7.6, 3.4], [sin(a) * 0.6, -1.6, -0.8], 0.8, 0.1, thorn);
}
// Thorns on the shoulders.
mirror_x() for (t = [[11, -6, 26, 1, -1.2, 1.8], [14, 0, 26, 1.5, 0, 2]]) spike([t[0], t[1], t[2]], [t[3], t[4], t[5]] * 2.4, 1.6, 0.1, thorn);

// Legs: stumpy trunks with root toes.
mirror_x() {
  ell([5, 5.5, 5.5], [7, 0, 5.5], bark);
  blob([[[4.6, 5.5, 2], [7.2, -1.5, 2]], [[4, 4, 2.5], [7.2, 1, 3]]], barkDk);
  for (a = [-25, 0, 25]) spike([7.2 + sin(a) * 3, -6.5, 1.2], [sin(a) * 0.5, -1.4, -0.5], 0.8, 0.1, thorn);
}
