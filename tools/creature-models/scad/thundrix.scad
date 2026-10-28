// Thundrix: Stormchick grown into a storm eagle with its wings flung up in a V: a golden head with a swept crest and
// glowing blue eyes, a white breast, wings layered gold, white and electric-blue (brown on top), a fanned golden tail and
// talons crackling with blue lightning.
include <lib.scad>

gold = [0.9, 0.7, 0.3];
goldHi = [0.98, 0.84, 0.45];
goldDark = [0.72, 0.5, 0.2];
white = [0.95, 0.95, 0.96];
blue = [0.24, 0.47, 0.8];
blueHi = [0.4, 0.62, 0.92];
brown = [0.5, 0.33, 0.2];
beak = [0.95, 0.75, 0.3];
talon = [0.95, 0.68, 0.25];
glow = [0.45, 0.8, 1];
bolt = [0.6, 0.85, 1];

// A flat feather of length l and width w lying along angle th (degrees from +X in the XZ plane) starting at p.
module feather(p, th, l, w, t, col) {
  color(col) translate(p + [cos(th), 0, sin(th)] * l * 0.5) rotate([0, -th, 0]) scale([l * 0.5, t, w]) sphere(1, $fn = 12);
}

// One wing on the +X side: the arm runs from the shoulder up and out; feathers hang from it and fan outward towards the
// tip. Front layers gold and white, top (back) layers brown, the long flight feathers blue on both sides.
root = [5, 1.5, 25];
tip = [27, 3, 43];
N = 10;
function fp(i) = root + (tip - root) * (i / N);
function fth(i) = -98 + (i / N) * 122;
function fd(i) = [cos(fth(i)), 0, sin(fth(i))];
module wing() {
  chain([root, root + (tip - root) * 0.5 + [0, 0, 1.5], tip], [2.6, 2, 1.2], gold);
  // Thin membranes filling the gaps: white over gold on the front, brown on top.
  color(white) hull() for (i = [0 : N]) translate(fp(i) + fd(i) * (9 + i * 0.25) + [0, -0.3, 0]) scale([1, 0.2, 1]) sphere(1.2, $fn = 8);
  color(brown) hull() for (i = [0 : N]) translate(fp(i) + fd(i) * (9 + i * 0.25) + [0, 0.5, 0]) scale([1, 0.2, 1]) sphere(1.2, $fn = 8);
  for (i = [0 : N]) {
    t = i / N;
    p = fp(i);
    th = fth(i);
    d = fd(i);
    feather(p + d * 5, th, 12 + t * 5, 2.2, 0.45, i % 2 == 0 ? blue : blueHi);
    feather(p + [0, -0.8, 0] + d * 1.5, th, 9.5 + t * 2, 2.4, 0.4, white);
    feather(p + [0, -1.3, 0], th, 6 + t, 2.6, 0.45, i % 2 == 0 ? gold : goldHi);
    feather(p + [0, 1, 0] + d * 1.5, th, 9.5 + t * 2, 2.4, 0.4, i % 3 == 0 ? white : brown);
    feather(p + [0, 1.4, 0], th, 6 + t, 2.6, 0.45, brown);
  }
}
mirror_x() wing();

translate([0, 0, 18]) scale([1.25, 1.25, 1.15]) translate([0, 0, -18]) {
// Body: an upright, deep-chested eagle torso.
blob([[[6.5, 6, 8], [0, 1, 22]], [[5, 5, 6], [0, 1.5, 15]]], gold);
// White breast on the front, brown back.
blob([[[5, 3, 6.5], [0, -2.8, 21]], [[3.6, 2.4, 4.5], [0, -2.2, 14.5]]], white);
blob([[[5.6, 3, 7], [0, 4, 21]], [[4, 2.6, 5], [0, 4, 15]]], brown);

// Head: golden with a swept-back crest.
blob([[[4.4, 4.6, 4.4], [0, -0.5, 32]], [[3.4, 3, 3], [0, -3.2, 31.2]]], gold);
for (k = [[0, 4, 35, 0], [1.6, 3.6, 34, 1], [-1.6, 3.6, 34, 1], [0, 3, 36.4, 0]])
  limb([k[0], k[1] - 3, k[2] - 1], [k[0] * 1.4, k[1] + 3, k[2] + 2.4], 1.4, 0.2, k[3] == 0 ? goldHi : goldDark);
// Hooked beak.
chain([[0, -5.6, 31.4], [0, -8, 30.8], [0, -8.6, 29.2], [0, -7.8, 28.4]], [1.5, 1.1, 0.7, 0.3], beak);
// Blue mask stripe and glowing eyes under a stern brow.
mirror_x() {
  color(blue) translate([2.4, -4.2, 32]) rotate([0, 0, -25]) scale([2.2, 0.6, 0.9]) sphere(1, $fn = 14);
  color(glow) translate([2.5, -4.6, 32]) rotate([0, 0, -25]) scale([1.2, 0.5, 0.75]) sphere(1, $fn = 14);
  color(white) translate([2.7, -4.9, 32.1]) sphere(0.35, $fn = 8);
  color(goldDark) translate([2.4, -4.2, 33.2]) rotate([0, -14, -25]) scale([2.2, 0.8, 0.6]) sphere(1, $fn = 14);
}

}
// Fanned tail feathers pointing down and back.
for (a = [-30 : 12 : 30]) {
  th = -90 + a;
  translate([0, 4, 0]) feather([a * 0.06, 0, 13], th, 12, 1.8, 0.5, abs(a) > 20 ? goldDark : gold);
}

// Legs and talons gripping lightning.
mirror_x() {
  limb([3, -0.5, 13], [4, -2.5, 6], 1.6, 1.1, goldHi);
  for (a = [-35, 0, 35]) chain([[4, -2.5, 5.6], [4 + sin(a) * 2, -4.4, 4.6], [4 + sin(a) * 2.4, -5.2, 3.2]], [0.6, 0.5, 0.15], talon);
  limb([4, -1.5, 5.6], [4, 0, 4.4], 0.5, 0.15, talon);
}
// Bolts crackling down from the talons.
module zig(p, s, col) color(col) translate(p) rotate([90, 0, 0]) scale(s)
  linear_extrude(height = 0.8, center = true) polygon([[0, 0], [1.4, 0], [0.5, -3], [2.2, -3], [-0.5, -9], [0.1, -4.4], [-1.2, -4.4]]);
zig([4.6, -4.4, 4.4], 0.5, bolt);
zig([-4, -4.4, 4.4], 0.45, bolt);
for (s = [[-15, -2, 18], [15, -2, 16], [-9, -3, 8], [10, -3, 10]]) zig(s, 0.45, s[0] > 0 ? bolt : [1, 0.86, 0.35]);
