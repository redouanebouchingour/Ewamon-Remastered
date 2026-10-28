// Infernomorel Majin: the corrupted Infernomorel. The same squat brute in a wide crouch, but its skin is cracked
// obsidian webbed with glowing magma, the cap is a crown of dark rock chunks with magma between them, the fire is a
// dark crimson blaze trailing black smoke, the eyes are red, the grin orange, and a burning sigil sits in its chest.
// Modelled off .cache/measure/infernomorel_majin (front 34.6 x 40 units, feet z = 0, art centre x = 0); the base
// model's body plan, with everything the form's art changes.
//
// Checklist (sheet x, z):
//   crown      x -14..13.5, z 17.4..25.7   a ring of dark rock chunks (M1 #3a3131) round a magma core; an orange-red
//              magma band on the underside (z 19..23) and magma pools between the chunks on top.
//   fire       x -12..13, z 23..38        dark crimson blaze (M0 #490409 / #960605), bright red inside, orange core
//              (#f1460b, #fa6d14 GLOW) at the front; leans up to the right; black smoke x 5..15, z 32..40.
//   head       x -7..7, z 11..21          obsidian, tucked low under the crown; spiky brow ridges on top.
//   eyes       far x -5..-2, near x 1..3.5, z 15.5..17.5   small red glowing slits, angry.
//   mouth      x -4.5..1.3, z 13..16.3    jagged orange grin (GLOW) in a dark mouth.
//   torso      shoulders x -9..10 z 14..21, hips x -11..13 z 4..12; obsidian (M1 #211817) with red magma cracks.
//   chest      x -4..3, z 7.2..14         sigil: orange ring, red disc, a dark split swirl.
//   arms       thick, out and down; fists far x -17..-7 z 3..14, near x 8..17 z 3..14 with magma cracks and four
//              long orange claws pointing down (to z 1.5).
//   legs       crouch: far foot x -11..-3 z 0..6, near foot x 6..13 z 0..4; orange toes.
//   back       obsidian covered in a bright red vein network, the crown's magma, the blaze and smoke, the claws.
//   glow       sprite: #f1460b and #fa6d14 glow (eyes' centre, grin, sigil ring, claw tips, fire core, magma pools).
include <lib.scad>

coal = [0.14, 0.10, 0.10];               // M1 dark obsidian
rock = [0.24, 0.20, 0.20];               // M1 light: the crown chunks, highlights
crimson = [0.36, 0.03, 0.04, NOGLOW];    // #490409 / #6e0607: outer blaze
red = [0.66, 0.03, 0.02, NOGLOW];        // #960605 / #b70905
bright = [0.87, 0.05, 0.02, NOGLOW];     // #de0d04: inner blaze, veins
magma = [0.95, 0.27, 0.04, GLOW];        // #f1460b GLOWS
magmaLt = [0.98, 0.43, 0.08, GLOW];      // #fa6d14 GLOWS
peach = [0.92, 0.44, 0.23, NOGLOW];      // #e9713b: claw tips
smoke = [0.14, 0.07, 0.07];              // #231213
ink = [0.03, 0.01, 0.01];

module frontHalf(y = 0) { translate([-60, y - 120, -10]) cube([120, 120, 80]); }
module backHalf(y = 0) { translate([-60, y, -10]) cube([120, 120, 80]); }
module vein(pts, r = 0.32, c = bright) { chain(pts, [for (p = pts) r], c); }

// ---- torso: squat, broad shoulders, obsidian; magma cracks laid flush front and back.
module torso(g = 0) {
  hull() {
    translate([0, 0, 8]) scale([9.2 + g, 7.5 + g, 4.5 + g]) sphere(1, $fn = 32);
    translate([0, 0.5, 17]) scale([10.2 + g, 7.6 + g, 4.6 + g]) sphere(1, $fn = 32);
  }
}
color(coal) torso();
// Front cracks.
module torsoVeins() {
  vein([[-6, -7, 19], [-4, -7.5, 16], [-5.5, -7.2, 13], [-4, -7, 10]]);
  vein([[6, -7, 19.5], [7.5, -6.8, 16], [6, -7.2, 13]]);
  vein([[-2, -7.8, 18.5], [0, -8, 16.5], [-1.5, -8, 15]]);
  vein([[3, -7.8, 15.5], [4.5, -7.6, 13], [3.5, -7.4, 10], [5, -7, 8]]);
  vein([[-7, -6.5, 10], [-8.5, -5.5, 7.5]]);
  vein([[7.5, -6.5, 10], [8.5, -5.5, 7]]);
  // Back network.
  vein([[0, 8.2, 20.5], [-1, 8.3, 17], [1, 8.3, 13], [-0.5, 8.0, 9], [1, 7.6, 6]], 0.4);
  vein([[-1, 8.3, 17], [-4, 8.0, 15], [-7, 7.0, 13]]);
  vein([[1, 8.3, 13], [4, 8.0, 11.5], [7.5, 6.8, 9]]);
  vein([[-0.5, 8.0, 9], [-3.5, 7.8, 7.5], [-6, 6.8, 5.5]]);
  vein([[-1, 8.3, 17], [3, 8.1, 18.5], [6.5, 7.3, 20]]);
  vein([[1, 8.3, 13], [-3, 8.1, 11], [-6.5, 7.2, 10]]);
  vein([[0, 8.2, 20.5], [-3, 8, 21.5], [-7, 7, 21]]);
  vein([[4, 8.0, 11.5], [5, 7.9, 15], [8, 7, 17]]);
}
color(bright) intersection() { torso(0.45); torsoVeins(); }
// Chest sigil: orange ring, red disc, a dark split swirl, laid flush on the chest.
sigilC = [-0.5, 10.6];
module ring(r0, r1) { difference() { circle(r1, $fn = 32); circle(r0, $fn = 32); } }
color(magma) intersection() { torso(0.5); pp(0) translate([sigilC[0], 0, sigilC[1]]) rotate([90, 0, 0]) linear_extrude(60, center = true) ring(2.7, 3.5); }
color(red) intersection() { torso(0.5); pp(0) translate([sigilC[0], 0, sigilC[1]]) rotate([90, 0, 0]) linear_extrude(60, center = true) circle(2.7, $fn = 32); }
color(ink) intersection() {
  torso(0.75);
  pp(0) translate([sigilC[0], 0, sigilC[1]]) rotate([90, 0, 0]) linear_extrude(60, center = true) {
    intersection() { ring(1.6, 2.4); translate([-3, 0]) square([3, 3]); }
    intersection() { ring(1.6, 2.4); translate([0, -3]) square([3, 3]); }
    translate([-0.3, -1.6]) square([0.6, 3.2]);
  }
}

// ---- head: tucked low under the crown, turned 20 degrees to the camera; spiky brow ridges, red eyes, orange grin.
translate([0, -3, 0]) rotate([0, 0, 20]) translate([0, 3, 0]) {
  color(coal) hull() {
    translate([0, -3, 16]) scale([7.2, 6.2, 4.8]) sphere(1, $fn = 30);
    translate([0, -4, 13]) scale([6, 5.2, 2.6]) sphere(1, $fn = 24);
  }
  // Brow ridges: three dark spikes sweeping back over the brow.
  for (sp = [[0, -8.5, 19.5, 0, -1.5, 4.5], [-4, -7.5, 19, -1.8, -1, 3.8], [4, -7.5, 19, 1.8, -1, 3.8], [-6.5, -5, 18, -2, 0, 3], [6.5, -5, 18, 2, 0, 3]])
    spike([sp[0], sp[1], sp[2]], [sp[3], sp[4], sp[5]], 1.3, 0.1, coal);
  mirror_x() vein([[2.5, -8.5, 19], [1, -8.8, 17.8]], 0.25);
  // Eyes: small red slits rising outwards, a lighter centre.
  mirror_x() {
    translate([3.4, -8.3, 16.8]) rotate([0, 0, 25]) rotate([0, -30, 0]) {
      color(bright) scale([2.0, 0.9, 1.0]) sphere(1, $fn = 12);
      color(magmaLt) translate([0.3, -0.5, 0]) scale([1.0, 0.7, 0.5]) sphere(1, $fn = 8);
    }
    color(coal) translate([3.4, -8.2, 18.3]) rotate([0, 0, 25]) rotate([0, -30, 0]) scale([2.6, 1.3, 0.9]) sphere(1, $fn = 10);
  }
  // Grin: a dark mouth with jagged orange teeth.
  color(ink) translate([-0.5, -8.4, 14.3]) scale([3.8, 0.9, 1.6]) sphere(1, $fn = 18);
  for (t = [[-3.2, 0.8], [-2, 1.1], [-0.8, 1.3], [0.4, 1.2], [1.6, 1.0], [2.6, 0.7]]) {
    color(magmaLt) translate([t[0] - 0.3, -8.9 - (0.15 * abs(t[0]) / 3), 14.9]) cube([0.9, 0.7, t[1] * 1.2], center = true);
    color(magma) translate([t[0] + 0.3, -8.9 - (0.15 * abs(t[0]) / 3), 13.6]) cube([0.9, 0.7, t[1] * 0.9], center = true);
  }
}

// ---- crown: a dark rock pillow ringed with faceted chunks, magma on its underside and pooled on top.
crownC = [0, -1, 21.2];
module crownShape(g = 0) {
  hull() {
    scale([14 + g, 11.5 + g, 2.4 + g]) sphere(1, $fn = 40);
    translate([0, 0, 2]) scale([10.5 + g, 8.5 + g, 3 + g]) sphere(1, $fn = 32);
  }
}
translate(crownC) rotate([-16, 0, 0]) {
  color(coal) crownShape();
  // Magma band on the underside rim, orange-red.
  color(bright) intersection() { crownShape(0.3); translate([-30, -30, -1.6]) cube([60, 60, 2.2]); }
  color(magma) intersection() { crownShape(0.5); translate([-30, -30, -1.0]) cube([60, 60, 1.2]); }
  // Magma pool on top under the blaze.
  color(magma) translate([0, 0, 4.2]) scale([10, 8, 1.4]) sphere(1, $fn = 28);
  // Rock chunks round the rim: [azimuth, size x, size y, size z, lift, spin].
  for (c = [[-100, 4.5, 3.4, 3.6, 1.2, 20], [-130, 4.0, 3.2, 3.2, 0.8, -15], [-160, 4.2, 3.0, 3.5, 1.0, 30], [170, 3.8, 3.0, 3.0, 0.6, 10],
            [140, 4.4, 3.2, 3.4, 1.0, -25], [110, 4.0, 3.0, 3.6, 1.4, 15], [75, 4.3, 3.3, 3.2, 0.8, -10], [40, 4.0, 3.2, 3.6, 1.2, 25],
            [10, 4.5, 3.4, 3.4, 0.8, -20], [-25, 4.2, 3.2, 3.8, 1.4, 15], [-55, 4.4, 3.4, 3.2, 1.0, -30], [-80, 3.6, 2.8, 4.0, 1.8, 10]]) {
    az = c[0];
    p = [13.2 * cos(az), 10.8 * sin(az), c[4] + 0.6];
    color(rock) translate(p) rotate([0, 0, az + c[5]]) rotate([15, 0, 0]) scale([c[1] * 0.9, c[2] * 0.9, c[3] * 0.9]) sphere(1, $fn = 7);
    // a magma seam under each chunk
    color(magmaLt) translate(p + [0, 0, -1.6]) rotate([0, 0, az]) scale([c[1] * 0.7, c[2] * 0.6, 0.6]) sphere(1, $fn = 8);
  }
  // Taller spikes at the front of the crown (the art's jagged front edge).
  for (sp = [[-70, 2.6, 4.5], [-105, 2.4, 4.0], [-40, 2.4, 3.8]])
    spike([12.5 * cos(sp[0]), 10.3 * sin(sp[0]), 2.5], [cos(sp[0]) * 1.5, sin(sp[0]) * 1.5, sp[2]], sp[1], 0.2, coal);
}

// ---- blaze: a bright red mass with a dark crimson back and top (towards the smoke), an orange core at the front;
// tongues lean up to the right.
translate([1, -1.5, 29]) {
  color(crimson) hull() { translate([1, 2.5, -0.5]) scale([11.5, 8, 4.5]) sphere(1, $fn = 32); translate([2.5, 2, 3.5]) scale([8.5, 6, 5]) sphere(1, $fn = 28); }
  color(red) hull() { translate([0, 0, -1]) scale([12, 8.5, 4.2]) sphere(1, $fn = 32); translate([0.5, -0.5, 2.5]) scale([8.5, 6, 4.5]) sphere(1, $fn = 28); }
  color(bright) hull() { translate([-0.5, -3.5, -1]) scale([9.5, 6, 3.6]) sphere(1, $fn = 28); translate([0, -3, 2]) scale([6.5, 4.5, 4]) sphere(1, $fn = 24); }
  color(magma) hull() { translate([-1, -6, -1.2]) scale([6.5, 4, 3]) sphere(1, $fn = 20); translate([-0.5, -5.5, 1.2]) scale([4.2, 3, 2.8]) sphere(1, $fn = 16); }
  color(magmaLt) translate([-1.5, -7.8, -1]) scale([3.6, 2, 2.2]) sphere(1, $fn = 14);
  // Tongues: [x, y, base r, height, colour, lean x, lean y].
  for (f = [[1, -2, 3.0, 9.5, crimson, 2.5, 0], [0.5, -2.5, 2.2, 8, red, 2, 0], [0, -3.5, 1.4, 6.5, bright, 1.5, 0],
            [-8, -4.5, 2.4, 5, red, 0, -0.5], [-11, 0, 2.0, 3.5, red, -1, 0], [-6, -7, 2.4, 6, red, 0.5, -0.8],
            [-5.5, -6, 1.4, 4.5, bright, 0.5, -0.4], [-3, -8, 2.2, 4.5, red, 0.5, -1.2], [3, -8, 2.2, 5, red, 1, -1.2],
            [3.5, -7, 1.3, 3.5, magma, 1, -0.4], [7, -6, 2.4, 6, red, 2, -0.8], [10, -2.5, 2.2, 5.5, crimson, 2.5, -0.4],
            [11, 3, 2.0, 5, crimson, 2.5, 0.4], [6.5, 7, 2.4, 6.5, red, 1.5, 1.2], [0.5, 8, 2.6, 7.5, crimson, 1.5, 1.6],
            [1, 7, 1.6, 6, bright, 1, 0.8], [-5.5, 7, 2.4, 6.5, red, 0, 1.2], [-10, 4.5, 2.0, 4, red, -1, 0.8],
            [-4, 2, 2.4, 8, red, 0.5, 0], [4.5, 1.5, 2.4, 8.5, red, 2, 0], [-3.5, 1.5, 1.4, 6.5, bright, 0.5, 0],
            [4, 1, 1.4, 7, bright, 1.5, 0], [-12, 2.5, 1.4, 2.5, red, -1, 0.4], [13, -1, 1.4, 4.5, crimson, 2.5, 0],
            [-7.5, 0, 2.0, 6, red, 0, 0], [8, 0.5, 2.0, 7.5, crimson, 2, 0], [-2.5, -5.5, 1.2, 6, magma, 0.5, -0.3],
            [2, 4.5, 1.6, 8, red, 1.5, 0.4], [-7, 4, 1.6, 5, red, 0, 0.4], [6, -4.5, 1.6, 6, red, 1.5, -0.6]])
    color(f[4]) hull() {
      translate([f[0], f[1], 0]) sphere(f[2], $fn = 10);
      translate([f[0] + f[5] * 0.5, f[1] + f[6] * 0.5, f[3] * 0.55]) sphere(f[2] * 0.7, $fn = 8);
      translate([f[0] + f[5], f[1] + f[6], f[3]]) sphere(0.3, $fn = 6);
    }
}
// Black smoke curling off the top of the blaze to the upper right.
chain([[4, 1, 34.5], [7, 2, 37], [10.5, 3, 38.5], [13.5, 4, 40], [16, 4.5, 40.5]], [2.8, 2.6, 2.2, 1.8, 1.0], smoke);
chain([[8, -1, 36], [11, -0.5, 38.5], [13, 0, 40.5]], [2.0, 1.6, 0.8], smoke);
chain([[1, 3, 37], [2.5, 4, 39.5], [4.5, 5, 41]], [1.6, 1.3, 0.6], smoke);
chain([[12, 2, 35.5], [15, 2.5, 36.5], [17, 3, 38]], [1.4, 1.1, 0.5], smoke);

// ---- arms: thick, out and down; obsidian fists cracked with magma and four long orange claws.
mirror_x() {
  limb([9, -1, 18], [13, -2, 12], 3.6, 3.2, coal);
  limb([13, -2, 12], [15.5, -2.5, 8.5], 3.2, 3.5, coal);
  color(coal) translate([16, -3, 8.5]) scale([4.4, 4.2, 4.0]) sphere(1, $fn = 24);
  // Magma cracks on the arm and fist.
  vein([[10.5, -4.4, 17], [12, -5, 14.5], [14, -5.2, 12.5]]);
  vein([[13.5, 1.0, 13], [15.5, 0.8, 10.5], [17.5, 0.5, 8]]);
  vein([[15, -6.8, 10.5], [17.5, -6.5, 8], [19.5, -5.5, 7]], 0.4);
  vein([[13.5, -6.0, 9], [15, -6.6, 6.5], [17, -6.2, 5]]);
  vein([[18.5, -4, 11.5], [20, -3, 9]]);
  vein([[11, -3, 20.5], [12.5, -1, 18.5]]);
  // Claws: four, long, pointing down and out: orange with peach tips.
  for (a = [-45, -15, 15, 45]) {
    c = [16 + sin(a) * 3.6, -4 + cos(a) * 3.4 - 3.4, 6.5];
    d = [sin(a) * 2.6 + 1.0, cos(a) * 1.4 - 1.4, -6.5];
    color(magma) hull() { translate(c) sphere(1.3, $fn = 10); translate(c + d * 0.5) sphere(0.9, $fn = 8); }
    color(peach) hull() { translate(c + d * 0.5) sphere(0.9, $fn = 8); translate(c + d) sphere(0.15, $fn = 6); }
    color(ink) translate(c + [0, 0, 0.9]) scale([1.4, 1.4, 0.6]) sphere(1, $fn = 8);
  }
}

// ---- legs: a wide crouch, thick thighs out from the hips to flat feet; magma cracks, orange toes.
mirror_x() {
  limb([5, 0.5, 8.5], [9.5, 2, 4.5], 3.8, 3.4, coal);
  color(coal) hull() {
    translate([10, 2.5, 2.8]) scale([3.8, 3.4, 2.8]) sphere(1, $fn = 24);
    translate([10.5, -3.2, 2.0]) scale([3.2, 2.6, 2.0]) sphere(1, $fn = 20);
  }
  vein([[6, -3.3, 9], [8, -2.5, 6.5], [10.5, -2.2, 4.5]]);
  vein([[7.5, 4.6, 8], [9.5, 5, 5], [11.5, 4.5, 3]]);
  vein([[12.5, 0.5, 5.5], [13.2, -1, 3.5]]);
  vein([[9, 0, 2.3], [11, -1.5, 1.6]], 0.3, magma);
  for (a = [-30, 0, 30]) {
    c = [10.5 + sin(a) * 2.2, -5.6, 1.4];
    color(magma) hull() { translate(c) sphere(0.9, $fn = 8); translate(c + [sin(a) * 1.2, -2.4, -0.7]) sphere(0.2, $fn = 6); }
  }
}
