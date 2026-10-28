// Budwing: a green caterpillar-dragon hatchling. A big head on an upright neck, twig antlers, a long segmented body
// armoured with brown bark plates marked with glowing green spirals, three pairs of stubby legs with red claws, small
// red-tipped leaf wings and a tail ending in an orange flower bud.
include <lib.scad>

green = [0.36, 0.6, 0.27];
greenHi = [0.5, 0.72, 0.35];
greenDk = [0.22, 0.42, 0.2];
bark = [0.55, 0.4, 0.26];
barkDk = [0.42, 0.29, 0.18];
glow = [0.45, 0.88, 0.4];
antler = [0.5, 0.36, 0.25];
wingTip = [0.85, 0.3, 0.2];
claw = [0.85, 0.25, 0.18];
bud = [0.98, 0.5, 0.12];
budCore = [1, 0.75, 0.25];

// Low-poly ellipsoid for the many small plates.
module ell16(r, p, c) { color(c) translate(p) scale(r) sphere(1, $fn = 14); }

// Branching twig antler from p, leaning outward by `out` (x sign).
module antler(p, s) {
  a = p + [s * 1.2, 0.6, 6];
  b = a + [s * 1.6, 0.4, 4];
  limb(p, a, 0.75, 0.6, antler);
  limb(a, b, 0.6, 0.4, antler);
  limb(a, a + [-s * 1.8, 0.2, 3], 0.5, 0.35, antler);
  limb(b, b + [s * 2.2, 0, 1.2], 0.4, 0.3, antler);
  limb(b, b + [-s * 0.4, 0, 2.6], 0.4, 0.3, antler);
}

// Body segments along +Y, each with a bark plate and a glowing spiral on the flanks.
segs = [[0, 6.8, 6.5], [4.5, 6.6, 6.2], [9, 6.2, 5.8], [13.5, 5.6, 5.2], [17.5, 4.8, 4.6], [21, 3.8, 3.8], [24, 2.8, 3.2]];
for (i = [0 : len(segs) - 1]) {
  s = segs[i];
  y = s[0]; r = s[1]; z = s[2];
  ell([r, 2.9, r * 0.92], [0, y, z], green);
  // Bark plates on top.
  ell16([r * 0.62, 2.4, r * 0.4], [0, y, z + r * 0.68], bark);
  mirror_x() ell16([r * 0.42, 2.2, r * 0.38], [r * 0.62, y, z + r * 0.42], i % 2 == 0 ? bark : barkDk);
  // Glowing spiral (a ring + dot) on each flank.
  mirror_x() translate([r * 0.95, y, z - r * 0.15]) rotate([0, 90, 0]) {
    color(glow) difference() {
      cylinder(h = 0.5, r = r * 0.26, center = true, $fn = 12);
      cylinder(h = 1, r = r * 0.18, center = true, $fn = 12);
    }
    color(glow) cylinder(h = 0.6, r = r * 0.07, center = true, $fn = 6);
  }
}
// Pale belly band under the front segments.
ell([5.2, 9, 2.5], [0, 6, 2.6], greenHi);

// Tail stem with an orange bud on the end.
chain([[0, 25.5, 4.2], [0, 27.5, 7], [0.5, 27.5, 10]], [1.4, 0.9, 0.6], greenDk);
mirror_x() petal([1.4, 0.4, 0.7], [1.3, 27.5, 9], [0, -30, 0], greenHi);
blob([[[1.6, 1.6, 2.2], [0.5, 27.5, 12]], [[0.6, 0.6, 0.6], [0.5, 27.5, 14.6]]], bud);
ell([0.9, 0.9, 1.2], [0.5, 26.4, 12.3], budCore);

// Neck rising from the front segment, ringed with paler scale bands.
chain([[0, -1, 8], [0, -3, 13], [0, -3.2, 17]], [5.2, 4.6, 4.4], green);
for (z = [9.5, 12.5, 15.5]) ell16([4.9, 4.7, 0.6], [0, -2.4 - (z - 9) * 0.12, z], greenDk);
// Bark plates trailing down the back of the neck.
for (z = [12, 16, 20]) ell16([2.2, 1.6, 1.8], [0, 1.4, z], bark);

// Head: a broad blunt dragon head.
blob([[[9, 7.6, 6.8], [0, -3.5, 22]], [[6.8, 4.6, 4.2], [0, -9, 20.4]]], green);
// Brow ridges and a bark-plate crown.
ell([3.6, 3, 1.6], [0, -1, 27.6], bark);
ell([2.4, 2.4, 1.2], [0, 2, 26], barkDk);
mirror_x() ell([2.4, 2.4, 1.4], [4.2, -1, 26.6], bark);
// Mouth line and nostrils.
color(greenDk) translate([0, -11.8, 18.9]) scale([5.4, 1.4, 0.35]) sphere(1, $fn = 16);
mirror_x() ell([0.45, 0.35, 0.35], [1.8, -13.4, 21.4], greenDk);
// Fierce orange eyes with heavy brows, and glowing spirals on the cheeks.
mirror_x() {
  eye([4.6, -9.4, 23.2], 2.2, iris = [0.98, 0.5, 0.08], pupil = [0.3, 0.05, 0.02], sclera = [1, 0.85, 0.4], yaw = -28, flat = 0.42);
  color(greenDk) translate([4.6, -10, 25.4]) rotate([0, 16, -28]) scale([2.9, 1, 0.7]) sphere(1, $fn = 14);
  translate([8.5, -3, 22]) rotate([0, 90, 0]) {
    color(glow) difference() {
      cylinder(h = 0.5, r = 1.6, center = true, $fn = 16);
      cylinder(h = 1, r = 0.9, center = true, $fn = 12);
    }
  }
}
// Antlers.
mirror_x() antler([3, -1.5, 27], 1);

// Small leafy wings with red tips, behind the neck.
mirror_x() translate([4, 4, 16]) rotate([0, 0, 30]) {
  for (k = [0 : 3]) {
    a = 15 + k * 17;
    color(k % 2 == 0 ? green : greenHi) rotate([0, a, 0]) translate([0, 0, 5]) scale([1.3, 0.5, 5.5]) sphere(1, $fn = 14);
    color(wingTip) rotate([0, a, 0]) translate([0, 0, 10]) scale([0.8, 0.45, 1.4]) sphere(1, $fn = 10);
  }
}

// Three pairs of stubby legs with red claws.
mirror_x() for (y = [0, 8, 15]) {
  limb([4.6, y, 4], [5.4, y - 0.6, 1.1], 1.9, 1.5, greenDk);
  for (d = [-0.7, 0.7]) spike([5.4 + d, y - 1.6, 0.6], [d * 0.4, -1, -0.2], 0.45, 0.05, claw);
}
