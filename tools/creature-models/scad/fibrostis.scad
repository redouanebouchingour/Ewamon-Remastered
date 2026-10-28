// Fibrostis: a small shaggy grey fibre-creature, all strands and tufts, with two big pale round eyes peering out of
// the fur and wisps of loose fibre drifting around it.
include <lib.scad>

fur = [0.62, 0.62, 0.6];
furHi = [0.8, 0.8, 0.74];
furDk = [0.42, 0.4, 0.46];
sclera = [0.86, 0.88, 0.8];
iris = [0.58, 0.62, 0.52];
pupil = [0.12, 0.12, 0.14];
wisp = [0.88, 0.88, 0.82];

// Fur shingles lying on an ellipsoid surface: centre c, radii r, list of [azimuth, elevation, length]. Each is a
// flattened strand that follows the surface downward with its tip lifting off, so the coat reads as shaggy hair.
module tufts(c, r, list, w = 1.5) {
  for (i = [0 : len(list) - 1]) {
    t = list[i];
    az = t[0]; el = t[1]; l = t[2];
    n = [cos(el) * cos(az), cos(el) * sin(az), sin(el)];
    p = [c[0] + r[0] * n[0], c[1] + r[1] * n[1], c[2] + r[2] * n[2]];
    color(i % 4 == 0 ? furDk : (i % 2 == 1 ? furHi : fur))
      translate(p) rotate([0, 0, az]) rotate([0, -el - 18, 0]) translate([0, 0, -l * 0.55])
        scale([0.55, w, l]) sphere(1, $fn = 8);
  }
}

// Body: a shaggy pear, head merged into it.
blob([[[9, 8, 8.5], [0, 0, 13]], [[8.5, 8, 8], [0, -0.5, 23]]], fur);
// Head crown, a bit wider and messy.
ell([9.5, 8.5, 8], [0, -0.5, 26], fur);

// Tufts all over: rows of elevation, staggered azimuths.
tufts([0, -0.5, 26], [9.5, 8.5, 8],
  [for (el = [-38, -15, 5, 25, 45, 65], k = [0 : 13]) let(az = k * 360 / 14 + el * 0.7 + 5)
     if (el > 40 || abs(((az - 270 + 720) % 360) - 180) < 125) [az, el, el > 50 ? 4.5 : 4]]);
tufts([0, 0, 13.5], [9, 8, 8.8],
  [for (el = [-38, -18, 2, 22], k = [0 : 13]) [k * 360 / 14 + 12 + el, el, 4.4]]);
// A wild crest of long strands on top, swept to the viewer's right.
for (i = [0 : 6]) {
  a = -40 + i * 13;
  chain([[sin(a) * 5, -1 + i % 3, 32], [sin(a) * 7 + 2, (i % 3), 35.5], [sin(a) * 8 + 5, 1, 36.5 + (i % 2) * 1.2]],
        [1.6, 1.0, 0.2], i % 2 == 0 ? furHi : fur);
}

// Face: a lighter fur patch with a radiating whisker mouth, big round eyes.
ell([6.8, 2.4, 5.6], [0, -7.4, 24.5], furHi);
// Strands radiating from the snout across the face.
for (a = [0 : 30 : 330]) color(a % 60 == 0 ? fur : furDk)
  translate([0, -9.4, 23.4]) rotate([0, -a, 0]) translate([3, 0, 0]) scale([3, 0.4, 0.45]) sphere(1, $fn = 8);
mirror_x() {
  // Dark socket ring around each eye.
  color(furDk) translate([3.5, -8.8, 26.2]) rotate([0, 0, -14]) scale([3.3, 1.4, 3.4]) sphere(1, $fn = 20);
  eye([3.5, -9.4, 26.2], 2.7, iris = iris, sclera = sclera, pupil = pupil, yaw = -14, flat = 0.7);
  // Whisker strands fanning out from the snout.
  for (a = [-20, 0, 25]) spike([0.8, -9.4, 21.8], [5 * cos(a), -1.2, 5 * sin(a) - 1.5], 0.45, 0.05, furDk);
}
// Little snout knot where the strands meet.
ell([1.4, 1, 1.1], [0, -9.6, 22.2], furDk);

// Arms: long shaggy, hanging down to knee height, with ragged fur and stubby claws.
mirror_x() {
  limb([8, -1, 20], [10.5, -2, 10], 3, 2.6, fur);
  tufts([9.4, -1.5, 15], [2.8, 2.8, 5], [for (el = [-30, 0, 30], k = [0 : 6]) [k * 360 / 7 + el, el, 3]], 1.1);
  ell([2.4, 2.4, 2], [10.6, -2.5, 8.4], fur);
  for (a = [-30, 0, 30]) spike([10.6 + sin(a) * 1.4, -4.3, 7.6], [sin(a) * 0.8, -1.2, -1.2], 0.55, 0.05, furDk);
}

// Legs: short thick stumps with wide splayed feet.
mirror_x() {
  limb([4.5, 0, 7], [4.8, -0.5, 2.5], 3.6, 3.2, fur);
  blob([[[3.4, 4.2, 1.6], [5, -1.8, 1.6]], [[2.6, 2, 1.3], [5, 1, 1.4]]], fur);
  for (a = [-30, 0, 30]) spike([5 + sin(a) * 1.8, -5.4, 1.0], [sin(a) * 0.8, -1.3, -0.4], 0.7, 0.05, furDk);
  tufts([4.8, -0.5, 5], [3.4, 3.4, 2], [for (k = [0 : 6]) [k * 360 / 7, 0, 2.6]], 1.1);
}

// Loose fibre wisps drifting beside it: wavy flat ribbons.
module wisp(x0, y0, z0, h, side) {
  for (i = [0 : 5]) {
    z = z0 + i * h / 6;
    if (i < 5) color(wisp) hull() {
      translate([x0 + side * sin(i * 70) * 1.8, y0, z]) scale([0.9, 0.4, 0.9]) sphere(1, $fn = 8);
      translate([x0 + side * sin((i + 1) * 70) * 1.8, y0, z + h / 6]) scale([0.9, 0.4, 0.9]) sphere(1, $fn = 8);
    }
  }
}
wisp(-15, 0, 6, 16, 1);
wisp(15.5, 1, 9, 16, -1);
wisp(-9, 2, 34, 6, 1);
