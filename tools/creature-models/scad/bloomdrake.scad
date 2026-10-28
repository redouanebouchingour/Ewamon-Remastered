// Bloomdrake: Budwing grown up. A taller neck with glowing green spiral scales down the chest, a smaller fierce head
// under big many-tined antlers, broad feathered leaf wings edged in red spread wide, the bark-plated caterpillar body
// on three pairs of legs, and an orange sunflower blooming on the tail tip.
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
petalO = [0.95, 0.45, 0.12];
petalR = [0.82, 0.28, 0.1];
seed = [0.42, 0.25, 0.1];

// Low-poly ellipsoid for the many small plates.
module ell16(r, p, c) { color(c) translate(p) scale(r) sphere(1, $fn = 14); }

// Branching twig antler from p, leaning outward by `out` (x sign).
module antler(p, s) {
  a = p + [s * 2.2, 0.6, 5];
  b = a + [s * 2.6, 0.4, 4];
  c = b + [s * 1.6, 0.2, 3.5];
  limb(p, a, 0.9, 0.7, antler);
  limb(a, b, 0.7, 0.55, antler);
  limb(b, c, 0.55, 0.35, antler);
  limb(a, a + [-s * 1.4, 0.2, 4], 0.5, 0.3, antler);
  limb(b, b + [-s * 0.8, 0, 3.6], 0.45, 0.3, antler);
  limb(b, b + [s * 3, 0, 0.8], 0.45, 0.3, antler);
  limb(c, c + [s * 2, 0, 0.6], 0.35, 0.25, antler);
  limb(c, c + [-s * 0.6, 0, 2.2], 0.35, 0.25, antler);
}

// Body segments along +Y, each with a bark plate and a glowing spiral on the flanks.
segs = [[0, 7, 6.8], [4.5, 7, 6.6], [9, 6.6, 6.2], [13.5, 6, 5.6], [17.5, 5.2, 5], [21.2, 4.4, 4.2], [24.6, 3.5, 3.6], [27.6, 2.6, 3]];
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

// Tail stem curling up to an orange sunflower that faces the viewer's right-front.
chain([[0, 29, 3.4], [-4, 31, 5], [-9, 30, 8], [-12, 27, 12]], [1.8, 1.4, 1.1, 0.9], green);
translate([-12.5, 26, 15]) rotate([0, 0, -20]) rotate([80, 0, 0]) scale(1.35) {
  for (i = [0 : 11]) color(i % 2 == 0 ? petalO : petalR) rotate([0, 0, i * 30 + (i % 2) * 15]) translate([3.6, 0, i % 2 * -0.3]) scale([2.4, 1.5, 0.45]) sphere(1, $fn = 12);
  color(seed) scale([2, 2, 0.9]) sphere(1, $fn = 18);
  color(petalO) translate([0, 0, 0.6]) scale([0.8, 0.8, 0.5]) sphere(1, $fn = 10);
}

// Neck rising from the front segment, ringed with paler scale bands.
chain([[0, -1, 8], [0, -3, 14], [0, -3.5, 21]], [5.6, 4.8, 4.2], green);
// Glowing spiral scales down the front of the chest.
function neckR(z) = z < 14 ? 5.6 - (z - 8) / 6 * 0.8 : 4.8 - (z - 14) / 7 * 0.6;
function neckY(z) = z < 14 ? -1 - (z - 8) / 6 * 2 : -3 - (z - 14) / 7 * 0.5;
for (z = [10, 13.5, 17, 20]) mirror_x() for (x = [2.1]) {
  r = neckR(z);
  ang = asin(x / r);
  translate([x, neckY(z) - sqrt(r * r - x * x) + 0.15, z]) rotate([90, 0, -ang]) {
    color(glow) difference() {
      cylinder(h = 0.5, r = 1.3, center = true, $fn = 12);
      cylinder(h = 1, r = 0.8, center = true, $fn = 12);
    }
    color(glow) cylinder(h = 0.5, r = 0.35, center = true, $fn = 6);
  }
}
// Bark plates trailing down the back of the neck.
for (z = [12, 16, 20, 24]) ell16([2.2, 1.6, 1.8], [0, 1.2 - (z - 12) * 0.08, z], bark);

// Head: a broad blunt dragon head.
translate([0, 0, 3.6]) scale(0.93) translate([0, 0, 0]) {
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
}

// Broad feathered leaf wings spread up and out in a V, each feather edged in red.
mirror_x() translate([4, 4, 18]) rotate([0, 0, 12]) rotate([0, 12, 0]) {
  for (k = [0 : 5]) {
    a = 18 + k * 11;
    l = 13 + (5 - abs(k - 1.5)) * 1.6;
    rotate([0, a, 0]) {
      color(k % 2 == 0 ? green : greenHi) translate([0, 0, l * 0.55]) scale([1.9, 0.5, l * 0.55]) sphere(1, $fn = 12);
      color(wingTip) translate([1.1, 0.1, l * 0.58]) scale([0.8, 0.42, l * 0.48]) sphere(1, $fn = 8);
    }
  }
  // Wing arm along the leading edge.
  limb([0, 0, 0], [sin(18) * 20, 0, cos(18) * 20], 1.2, 0.5, greenDk);
}

// Three pairs of stubby legs with red claws.
mirror_x() for (y = [0, 8, 15]) {
  limb([4.6, y, 4], [5.4, y - 0.6, 1.1], 1.9, 1.5, greenDk);
  for (d = [-0.7, 0.7]) spike([5.4 + d, y - 1.6, 0.6], [d * 0.4, -1, -0.2], 0.45, 0.05, claw);
}
