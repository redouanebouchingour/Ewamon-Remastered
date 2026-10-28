// Gustuff: a cloud-wool lamb with curled brown ram horns, little feathered wing-ears and pale blue wings on its back.
include <lib.scad>

wool = [0.88, 0.87, 1];
woolShade = [0.72, 0.7, 0.93];
face = [0.86, 0.85, 0.98];
wing = [0.66, 0.8, 0.97];
wingHi = [0.85, 0.92, 1];
horn = [0.55, 0.37, 0.24];
hornDark = [0.36, 0.23, 0.15];
hoof = [0.3, 0.22, 0.18];
nose = [0.25, 0.25, 0.32];

// Cloud body: one hull core plus puffs.
blob([[[8, 10, 7], [0, 2, 13]], [[7, 6, 7], [0, -4, 14]]], woolShade);
puffs = [[-6, -5, 15, 4.5], [6, -5, 15, 4.5], [0, -8, 13, 4.5], [-6.5, 2, 16, 4.5], [6.5, 2, 16, 4.5],
         [-5, 8, 15, 4.2], [5, 8, 15, 4.2], [0, 11, 14, 4.5], [0, 3, 20, 5], [-4, -3, 20, 4.2], [4, -3, 20, 4.2],
         [0, 9, 19, 4], [-7, 6, 10, 3.8], [7, 6, 10, 3.8], [-6.5, -3, 10, 3.8], [6.5, -3, 10, 3.8],
         [0, 0, 8.5, 4.5], [0, -6, 9, 3.8]];
for (p = puffs) ell([p[3], p[3], p[3] * 0.92], [p[0], p[1], p[2]], wool);
// Fluffy tail puff.
ell([3.2, 3, 3], [0, 14, 17], wool);

// Legs: woolly upper, slim lower, dark hooves.
mirror_x() for (y = [-5, 7]) {
  ell([3, 3, 3.4], [4.6, y, 7], wool);
  limb([4.6, y, 6], [4.6, y - 0.5, 1.6], 1.8, 1.6, woolShade);
  ell([1.9, 2.2, 1.2], [4.6, y - 0.8, 1.1], hoof);
}

// Head: woolly round head with a pale face.
ell([7.5, 7, 6.8], [0, -11, 22], wool);
mirror_x() ell([3.6, 3.6, 3.6], [4.2, -10, 26], wool);
ell([4, 3.6, 4.6], [0, -10, 28], wool);
blob([[[5.4, 3, 4.6], [0, -15, 21]], [[3.6, 2.4, 2.8], [0, -17, 19.2]]], face);
// Eyes, nose, smile.
mirror_x() eye([2.7, -17.2, 22.8], 1.7, iris = [0.35, 0.33, 0.6], pupil = [0.12, 0.1, 0.2], yaw = -18);
ell([1.1, 0.6, 0.75], [0, -19.3, 19.8], nose);
color(nose) translate([0, -19.1, 18.6]) rotate([90, 0, 0]) scale([1.5, 0.35, 0.3]) cylinder(h = 0.6, r = 1, center = true, $fn = 16);

// Curled ram horns at the sides of the head.
module curl() {
  for (i = [0 : 13]) {
    a = i * 30; r = 4.2 - i * 0.26;
    color(i % 2 == 0 ? horn : hornDark) hull() {
      translate([0, i * 0.12, 0]) rotate([0, a, 0]) translate([r, 0, 0]) sphere(1.8 - i * 0.09, $fn = 12);
      translate([0, i * 0.12 + 0.12, 0]) rotate([0, a + 30, 0]) translate([r - 0.26, 0, 0]) sphere(1.75 - i * 0.09, $fn = 12);
    }
  }
}
mirror_x() translate([7.2, -11, 24.5]) rotate([0, 0, 55]) rotate([0, 180, 0]) curl();

// Little feathered wings for ears, fanned up and out.
mirror_x() for (k = [0 : 2])
  petal([0.9, 1.4, 4.2 - k * 0.6], [7.2 + k * 0.9, -9.5, 29.5 - k * 0.4], [0, 25 + k * 18, 0], k == 0 ? wingHi : wing);

// Back wings: feather fans rising from the shoulders.
mirror_x() for (k = [0 : 4]) {
  len_ = 8 - k * 0.9;
  petal([1.2, 2.2, len_], [6 + k * 1.2, 2 + k * 1.6, 22 + len_ * 0.6], [-35 - k * 6, 40 + k * 5, 0], k % 2 == 0 ? wing : wingHi);
}
