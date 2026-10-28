// Glowtent: a cute lavender jellyfish, a glowing pink spot on its bell, shiny eyes, wavy pink and violet tentacles.
include <lib.scad>

bell = [0.68, 0.58, 0.9];
bellDark = [0.55, 0.45, 0.8];
glow = [0.98, 0.5, 0.78];
glowCore = [1, 0.82, 0.93];
tentPink = [0.92, 0.5, 0.78];
tentViolet = [0.66, 0.5, 0.86];
eyeDark = [0.18, 0.1, 0.2];
bubble = [0.8, 0.62, 0.95];

BZ = 21;     // bell rim height
BR = [13, 12, 11.5];

// Bell: a tall dome with a rounded rim and a darker underside.
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
patch(glow, 1.015, onBell(-90, 62), [8, 7.5, 6]);
patch(glowCore, 1.03, onBell(-90, 66), [4.6, 4.2, 3.6]);
color([0.88, 0.82, 1]) translate(onBell(-150, 55, 0.98)) rotate([35, 0, 30]) scale([2, 1, 0.5]) sphere(1, $fn = 12);

// Big shiny eyes low on the front of the bell.
mirror_x() eye(onBell(-90 + 22, 10, 0.97), 1.9, iris = eyeDark, pupil = [0.05, 0.02, 0.05], sclera = [0.95, 0.85, 0.92], yaw = 22, flat = 0.5);

// Tentacles: wavy strands hanging from under the bell to the ground, alternating pink and violet.
n = 12;
for (i = [0 : n - 1]) {
  a = i * 360 / n + 8;
  r0 = 7 + (i % 2) * 1.2;
  ph = i * 47;
  pts = [for (k = [0 : 6]) let(t = k / 6, z = BZ - 1 - t * (BZ - 1.4 - (i % 3) * 1.6), w = 1.6 * sin(ph + k * 70) * t)
    [r0 * cos(a) * (1 - 0.25 * t) + w * -sin(a), r0 * sin(a) * (1 - 0.25 * t) + w * cos(a), z]];
  chain(pts, [1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.55], i % 2 == 0 ? tentPink : tentViolet);
}

// Bubbles drifting around it.
for (p = [[-15, -2, 22], [-14, -3, 17], [15, -1, 21], [14.5, -2, 15.5], [-11, -4, 8], [11, -3, 7]]) ell([0.9, 0.9, 1.1], p, bubble);
