// Hyoryu (Majin): the corrupted form. The body darkens to deep blue, the mane turns lavender, the ice shards and the
// wing veins burn crimson, red icicles hang from the wings and the eyes glow red.
include <lib.scad>

body = [0.22, 0.5, 0.65];
bodyDark = [0.12, 0.24, 0.45];
belly = [0.55, 0.82, 0.88];
wingA = [0.3, 0.45, 0.85];
wingB = [0.85, 0.15, 0.22];
wingVein = [0.6, 0.08, 0.18];
mane = [0.72, 0.68, 0.95];
maneShade = [0.55, 0.48, 0.85];
shard = [0.85, 0.15, 0.28];
blade = [0.75, 0.88, 1];
horn = [0.5, 0.1, 0.25];
eyeC = [0.95, 0.1, 0.1];

// Spine path: neck down into a loop to the viewer's right, back across the ground to the left, up into the blade.
pts = [[-0.5, -2, 28], [0, -0.5, 24], [1, 0.5, 19], [1, 0.5, 14.5], [3.5, 1, 11], [8, 1.5, 13], [12.5, 1.5, 8.5],
       [10.5, 1, 3.5], [6, 0, 2.3], [1, -0.5, 3], [-3, -0.5, 5.5], [-6.5, 0, 4], [-10, 0.5, 2], [-14, 1, 2],
       [-16.5, 1, 4.5]];
rs = [2.4, 2.6, 2.7, 2.7, 2.6, 2.5, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.3, 1.0, 0.8];
chain(pts, rs, body);
// Pale belly scutes down the front of the neck.
chain([for (i = [0 : 4]) pts[i] + [0, -rs[i] * 0.55, 0]], [for (i = [0 : 4]) rs[i] * 0.6], belly);
// Darker dorsal stripe along the back half.
chain([for (i = [0 : len(pts) - 1]) pts[i] + [0, rs[i] * 0.55, rs[i] * 0.6]], [for (r = rs) r * 0.45], bodyDark);

// Crescent ice blade at the tail tip, curving up.
translate([-16.5, 1, 4]) rotate([62, 0, 0]) scale(1.4) {
  color(blade) linear_extrude(height = 1.2, center = true) difference() {
    translate([3, 0]) circle(6.5, $fn = 40);
    translate([5.2, 0.6]) circle(6.2, $fn = 40);
    translate([3, -6]) square([16, 12], center = true);
  }
}
translate([-16.5, 1, 4]) rotate([62, 0, 0]) scale(1.4) color(shard) translate([0, 0, 0.3]) linear_extrude(height = 1.2, center = true) difference() {
  translate([3, 0]) circle(6.5, $fn = 40);
  translate([4.4, 0.4]) circle(6.4, $fn = 40);
  translate([3, -6]) square([16, 12], center = true);
}
// Barb on the tail.
spike([-13, 1, 3], [1, 0, 3], 0.7, 0.05, blade);

// Ice shard crest along the coil.
for (i = [4 : 9]) for (k = [-1, 0, 1]) let(p = pts[i])
  spike(p + [k * 0.6, rs[i] * 0.4, rs[i] * 0.7], [k * 1.2, 1, 3 + (i % 2)], 0.75, 0.05, k == 0 ? shard : blade);
for (i = [1 : 13]) spike(pts[i] + [0, 0.3, rs[i] * 0.8], [0, 0.6, 2.2], 0.55, 0.05, shard);
for (i = [1 : 3]) mirror_x() spike(pts[i] + [rs[i] * 0.8, 0.5, 0], [1.6, 0.8, 0.6], 0.5, 0.05, shard);

// Small clawed forearms held up in front of the chest.
mirror_x() {
  limb([1.8, -1.5, 21], [3.6, -3.5, 18.5], 0.9, 0.75, body);
  limb([3.6, -3.5, 18.5], [3.4, -5, 20.5], 0.75, 0.6, body);
  for (a = [-35, 0, 35]) spike([3.4, -5.3, 20.8], [sin(a) * 0.9, -1, 0.8], 0.22, 0.05, blade);
}

// Crystal-feather wings: elongated pale petals fanning up and out from the shoulders.
module wing(side) {
  for (k = [0 : 6]) let(a = 8 + k * 14, l = 11 + (k < 4 ? k : 6 - k) * 2, c = k % 2 == 0 ? wingA : wingB)
    let(d = [side * sin(a) * l, 3 + k * 0.4, cos(a) * l * 0.95])
      color(c) hull() {
        translate([side * 1.8, 2, 21]) sphere(0.6, $fn = 8);
        translate([side * 1.8, 2, 21] + d * 0.55) scale([2.4, 0.9, 2.4]) sphere(1, $fn = 14);
        translate([side * 1.8, 2, 21] + d) sphere(0.15, $fn = 6);
      }
  // red icicles hanging under the wing
  for (k = [0 : 5]) let(x = side * (4 + k * 2.2), z = 22.5 + k * 0.9)
    spike([x, 3.2 + k * 0.3, z], [0, 0, -2.2 - (k % 2) * 1.2], 0.45, 0.05, shard);
  // wing arm (leading edge)
  chain([[side * 1.6, 1.8, 21], [side * 6, 3, 27], [side * 9, 4, 31]], [0.6, 0.5, 0.2], wingVein);
}
wing(1); wing(-1);

// Head: slim dragon head facing -Y, swept horns, frosty mane.
translate(pts[0] + [0, -1, 2.6]) scale(1.3) {
  blob([[[2.4, 2.4, 2.2], [0, 0, 0]], [[1.3, 2, 1.1], [0, -3.4, -0.6]]], body);
  ell([1.2, 1.3, 0.6], [0, -3.2, -1.3], belly);
  mirror_x() {
    eye([1.3, -1.9, 0.6], 0.7, iris = eyeC, pupil = [0.05, 0.15, 0.25], sclera = [0.95, 1, 1], yaw = -32, flat = 0.4);
    color(bodyDark) translate([1.4, -2.1, 1.3]) rotate([0, -20, -30]) scale([1.1, 0.45, 0.3]) sphere(1, $fn = 10);
    ell([0.22, 0.2, 0.2], [0.5, -5.2, -0.3], bodyDark);
    chain([[1.2, 0.2, 1.6], [2.2, 1.6, 3.8], [2.8, 3.4, 5.4]], [0.5, 0.35, 0.08], horn);
    chain([[1.8, -0.4, 0.6], [3.2, 0.8, 1.4], [4.2, 2, 1.8]], [0.35, 0.25, 0.06], horn);
  }
  // Mane: swept-back frosty locks.
  for (k = [0 : 8]) let(a = -80 + k * 20)
    color(k % 2 == 0 ? mane : maneShade) hull() {
      translate([2 * sin(a), 1, 1.2 + cos(a) * 0.6]) sphere(1.2, $fn = 10);
      translate([4.5 * sin(a), 5.5, 1.5 + (k % 3) * 1.2]) sphere(0.15, $fn = 6);
    }
  for (k = [0 : 4]) let(z = -1 - k * 1.8)
    color(k % 2 == 0 ? mane : maneShade) hull() {
      translate([0, 1.6, z]) sphere(1.3, $fn = 10);
      translate([(k % 2 == 0 ? 1 : -1) * 2.5, 5, z - 1.5]) sphere(0.15, $fn = 6);
    }
}
