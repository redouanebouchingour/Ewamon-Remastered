// Toxiveil: Glowtent grown into a dark violet poison jellyfish, a toxic-green skull on its bell, glaring green eyes,
// a thick curtain of purple and green tentacles dripping venom.
include <lib.scad>

bell = [0.3, 0.17, 0.45];
bellDark = [0.18, 0.1, 0.28];
toxic = [0.55, 0.95, 0.18];
socket = [0.2, 0.32, 0.08];
tentPink = [0.32, 0.17, 0.4];
tentViolet = [0.24, 0.36, 0.2];
eyeDark = [0.18, 0.1, 0.2];
bubble = [0.36, 0.2, 0.5];

BZ = 21;     // bell rim height
BR = [13, 12, 11.5];

// Bell: a dark dome with a rounded rim and a darker underside.
color(bell) translate([0, 0, BZ]) scale(BR) difference() {
  sphere(1, $fn = 40);
  translate([0, 0, -1.2]) cube(2.4, center = true);
}
color(bell) translate([0, 0, BZ]) scale([BR[0], BR[1], 2.2]) sphere(1, $fn = 40);
color(bellDark) translate([0, 0, BZ - 1]) scale([BR[0] - 1.4, BR[1] - 1.4, 1.6]) sphere(1, $fn = 32);

// Glowing pink spot, tilted toward the front, with a pale core; a shine on top.
function onBell(az, el, k = 1) = [BR[0] * k * cos(el) * cos(az), BR[1] * k * cos(el) * sin(az), BZ + BR[2] * k * sin(el)];
// A patch painted on the bell: the bell's skin, slightly inflated, clipped to an ellipsoid around a point.
module patch(c, k, at, r) {
  color(c) intersection() {
    translate([0, 0, BZ]) scale(BR * k) sphere(1, $fn = 40);
    translate(at) scale(r) sphere(1, $fn = 20);
  }
}
// Skull on the front of the bell, glowing green.
module skull(az, el, k = 1) {
  patch(toxic, 1.02 * k, onBell(az, el + 3), [4.4, 4.4, 3.4]);
  patch(toxic, 1.02 * k, onBell(az, el - 12), [2.8, 2.8, 2.4]);
  for (d = [-1, 1]) patch(bellDark, 1.035 * k, onBell(az + d * 10, el - 2), [1.7, 1.7, 1.6]);
  patch(bellDark, 1.035 * k, onBell(az, el - 9), [0.7, 0.7, 0.8]);
  for (d = [-1.5, -0.5, 0.5, 1.5]) patch(bellDark, 1.035 * k, onBell(az + d * 5.5, el - 15), [0.3, 0.4, 1.2]);
}
skull(-90, 52);
// The same skull smaller, high on the back.
skull(30, 50);
color([0.55, 0.35, 0.75]) translate(onBell(-150, 55, 0.98)) rotate([35, 0, 30]) scale([2, 1, 0.5]) sphere(1, $fn = 12);

// Glaring green eyes: slanted glowing slits under heavy dark brows.
mirror_x() {
  translate(onBell(-90 + 27, 16, 1)) rotate([0, 0, 27]) {
    color(bellDark) rotate([0, -20, 0]) translate([0, -0.2, 1.1]) scale([3.2, 1.1, 0.9]) sphere(1, $fn = 16);
    color(toxic) rotate([0, -20, 0]) scale([2.8, 1, 1.1]) sphere(1, $fn = 16);
    color([0.85, 1, 0.6]) rotate([0, -20, 0]) translate([0.6, -0.6, 0]) scale([1.2, 0.6, 0.5]) sphere(1, $fn = 10);
  }
}

// Tentacles: wavy strands hanging from under the bell to the ground, alternating pink and violet.
n = 16;
for (i = [0 : n - 1]) {
  a = i * 360 / n + 8;
  r0 = 7 + (i % 2) * 1.2;
  ph = i * 47;
  pts = [for (k = [0 : 6]) let(t = k / 6, z = BZ - 1 - t * (BZ - 1.4 - (i % 3) * 1.6), w = 1.6 * sin(ph + k * 70) * t)
    [r0 * cos(a) * (1 - 0.25 * t) + w * -sin(a), r0 * sin(a) * (1 - 0.25 * t) + w * cos(a), z]];
  chain(pts, [1.5, 1.35, 1.2, 1.05, 0.9, 0.8, 0.6], i % 2 == 0 ? tentPink : tentViolet);
  // A venom stripe on every other strand and a drip off its tip.
  if (i % 2 == 1) chain([for (k = [1 : 4]) pts[k] + [cos(a), sin(a), 0] * 0.9], [0.45, 0.4, 0.35, 0.3], toxic);
  if (i % 3 == 0) {
    ell([0.5, 0.5, 0.8], pts[6] + [0, 0, -0.4], toxic);
  }
}

// Bubbles drifting around it.
for (i = [0 : 5]) let(p = [[-15, -2, 22], [-14, -3, 17], [15, -1, 21], [14.5, -2, 15.5], [-11, -4, 8], [11, -3, 7]][i])
  ell([0.9, 0.9, 1.1], p, i % 2 == 0 ? bubble : toxic);
