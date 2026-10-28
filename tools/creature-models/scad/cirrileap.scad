// Cirrileap: Gustuff grown up, a long-legged sky-blue cloud ram with golden curled horns, a cloud ruff,
// a billowing cloud tail and two great feathered wings.
include <lib.scad>

module puff(r, p, c) { color(c) translate(p) scale(r) sphere(1, $fn = 20); }

cloud = [0.62, 0.74, 0.98];
cloudHi = [0.8, 0.88, 1];
cloudDeep = [0.38, 0.52, 0.9];
face = [0.72, 0.82, 1];
wing = [0.45, 0.6, 0.95];
wingHi = [0.72, 0.84, 1];
wingDeep = [0.28, 0.42, 0.82];
horn = [0.72, 0.55, 0.3];
hornDark = [0.5, 0.36, 0.18];
hoof = [0.25, 0.3, 0.6];

// Body: a hull core under cloud puffs.
blob([[[7, 10, 6.5], [0, 2, 17]], [[7, 6, 7], [0, -5, 18]]], cloudDeep);
puffs = [[-5.5, -5, 19, 4.5], [5.5, -5, 19, 4.5], [0, -8, 17, 4.6], [-6, 2, 20, 4.2], [6, 2, 20, 4.2],
         [-5, 8, 19, 4], [5, 8, 19, 4], [0, 4, 23.5, 4.5], [-6, -2, 14.5, 3.8], [6, -2, 14.5, 3.8],
         [-5.5, 7, 14.5, 3.6], [5.5, 7, 14.5, 3.6], [0, 1, 13, 4.2]];
for (p = puffs) puff([p[3], p[3], p[3] * 0.92], [p[0], p[1], p[2]], cloud);
// Cloud ruff around the chest and neck.
ruff = [[0, -11, 21, 4.6], [-4.5, -9.5, 23, 4], [4.5, -9.5, 23, 4], [0, -10, 26, 4], [-3.5, -8, 26.5, 3.4],
        [3.5, -8, 26.5, 3.4], [0, -12.5, 17, 3.6]];
for (p = ruff) puff([p[3], p[3], p[3]], [p[0], p[1], p[2]], cloudHi);

// Cloud tail: a curling stack of puffs out the back.
tail = [[0, 13, 21, 4], [0, 16, 24, 3.6], [0, 18.5, 27.5, 3.2], [0, 18.5, 31, 2.6], [0, 16.5, 33, 2]];
for (p = tail) puff([p[3], p[3], p[3]], [p[0], p[1], p[2]], p[1] > 17 ? cloudHi : cloud);

// Long slender legs with woolly tufts and blue hooves.
mirror_x() for (y = [-6, 8]) {
  ell([3, 3.2, 3.4], [4.4, y, 12], cloud);
  limb([4.4, y, 11], [4.4, y - 0.5, 1.6], 2, 1.5, cloudDeep);
  ell([2.6, 2.6, 2.4], [4.4, y - 0.2, 8], cloud);
  ell([1.9, 2.3, 1.2], [4.4, y - 0.9, 1.1], hoof);
}

// Head: a slim, elegant ram head on top of the ruff.
blob([[[5.6, 5.4, 5.2], [0, -12, 31]], [[3.2, 3, 2.8], [0, -18, 29]]], face);
ell([4.8, 4.4, 3.4], [0, -11, 35], cloudHi);
mirror_x() eye([2.8, -16.2, 31.6], 1.4, iris = [0.2, 0.25, 0.55], pupil = [0.05, 0.05, 0.15], yaw = -22);
ell([0.9, 0.5, 0.55], [0, -20.8, 29.4], [0.25, 0.3, 0.55]);
color([0.25, 0.3, 0.55]) translate([0, -20.6, 28]) rotate([90, 0, 0]) scale([1.1, 0.3, 0.3]) cylinder(h = 0.5, r = 1, center = true, $fn = 16);
// Small ears.
mirror_x() petal([0.8, 1.2, 2.2], [4.4, -10.5, 32], [0, 70, -20], cloudDeep);

// Golden curled horns.
module curl() {
  for (i = [0 : 14]) {
    a = i * 30; r = 4.6 - i * 0.26;
    color(i % 2 == 0 ? horn : hornDark) hull() {
      translate([0, i * 0.14, 0]) rotate([0, a, 0]) translate([r, 0, 0]) sphere(1.7 - i * 0.08, $fn = 12);
      translate([0, i * 0.14 + 0.14, 0]) rotate([0, a + 30, 0]) translate([r - 0.26, 0, 0]) sphere(1.65 - i * 0.08, $fn = 12);
    }
  }
}
mirror_x() translate([6, -11, 34.5]) rotate([0, 0, 55]) rotate([0, 180, 0]) curl();

// Great wings: layered feather fans swept up and back from the shoulders.
mirror_x() translate([5, -2, 25]) {
  for (k = [0 : 6]) {
    l = 15 - k * 1.1;
    petal([1.3, 2.6, l], [3 + k * 1.6, 2 + k * 1.3, l * 0.75], [-25 - k * 4, 35 + k * 7, 0], k % 2 == 0 ? wing : wingDeep);
  }
  // Coverts: shorter, paler feathers near the shoulder.
  for (k = [0 : 2]) {
    l = 7 - k * 0.6;
    petal([1.4, 2.4, l], [2 + k * 1.4, 0.5 + k * 1.1, l * 0.6 + 2], [-20 - k * 4, 32 + k * 8, 0], wingHi);
  }
}
