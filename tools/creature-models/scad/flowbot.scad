// Flowbot: a grey robot with a monitor for a head (an orange screen showing a smiling lavender chat bubble), a Dutch
// flag badge on its chest, cyan-lit joints and fingers, standing on a round hover base, crackling with yellow lightning.
include <lib.scad>

grey = [0.55, 0.57, 0.6];
greyDk = [0.32, 0.34, 0.38];
greyHi = [0.75, 0.77, 0.8];
cyan = [0.2, 0.85, 0.95];
screen = [1, 0.5, 0.3];
screenDk = [0.78, 0.3, 0.2];
bubble = [0.72, 0.7, 1];
ink = [0.1, 0.1, 0.15];
bolt = [1, 0.92, 0.1];
nlRed = [0.8, 0.12, 0.15];
nlBlue = [0.15, 0.25, 0.65];
white = [0.97, 0.97, 0.97];

// Hover base: a drum with a woven dark band, cyan thrusters underneath.
color(greyDk) translate([0, 0, 1.2]) cylinder(h = 3.2, r1 = 8.4, r2 = 9.4, $fn = 36);
color(grey) translate([0, 0, 4.4]) cylinder(h = 1, r1 = 9.4, r2 = 8.4, $fn = 36);
color(greyDk) translate([0, 0, 5.4]) cylinder(h = 0.6, r = 6, $fn = 30);
for (a = [0 : 30 : 330]) color(grey) translate([8.95 * cos(a), 8.95 * sin(a), 2.8]) rotate([0, 0, a]) scale([0.6, 1.4, 1]) sphere(1, $fn = 10);
for (a = [15 : 45 : 360]) color(cyan) translate([6 * cos(a), 6 * sin(a), 0.6]) sphere(0.9, $fn = 12);
color(greyDk) translate([0, 0, 0.6]) cylinder(h = 0.8, r = 7.6, $fn = 30);

// Legs: thighs, knees, shins on small feet.
mirror_x() {
  ell([1.6, 2.4, 1], [3.4, -0.5, 6.4], greyDk);
  limb([3.2, 0, 7], [3.6, -0.6, 10.5], 1.4, 1.5, grey);
  ell([1.6, 1.6, 1.4], [3.6, -0.8, 11], greyDk);
  limb([3.6, -0.8, 11], [3.2, 0, 14.5], 1.8, 2.2, grey);
  ell([0.5, 0.3, 0.6], [3.7, -2.4, 11], cyan);
}
// Pelvis and segmented waist.
blob([[[4.6, 3, 1.8], [0, 0, 15.5]]], grey);
for (z = [17.2, 18.4]) color(greyDk) translate([0, 0, z]) scale([3, 2.2, 0.6]) sphere(1, $fn = 20);
// Chest: a rounded armour block with cyan side lines and the flag badge.
blob([[[5.6, 3.6, 3.4], [0, 0, 22.5]], [[4.4, 3, 2], [0, 0, 19.5]]], grey);
ell([4.6, 2.4, 2.4], [0, -1.6, 23.5], greyHi);
mirror_x() limb([4.8, -2, 19.6], [5.6, -1.4, 23.4], 0.35, 0.35, cyan);
translate([0, -4.1, 23.2]) rotate([90, 0, 0]) {
  color(greyDk) cylinder(h = 0.3, r = 1.8, $fn = 20);
  for (b = [[nlRed, 0.5], [white, -0.5], [nlBlue, -1.5]]) color(b[0]) intersection() {
    translate([0, 0, 0.2]) cylinder(h = 0.4, r = 1.5, $fn = 20);
    translate([-2, b[1], 0]) cube([4, 1, 1]);
  }
}
// Neck.
color(greyDk) translate([0, 0, 25.5]) cylinder(h = 2, r = 1.4, $fn = 14);

// Shoulders and long arms hanging down with cyan clawed fingers.
mirror_x() {
  ell([2.4, 2.4, 2.2], [7, 0, 24.5], grey);
  ell([0.6, 0.4, 0.6], [7.4, -2.3, 24.6], cyan);
  limb([7.4, 0, 23.5], [8.6, -0.5, 18], 1.5, 1.4, grey);
  ell([1.4, 1.4, 1.3], [8.7, -0.5, 17.6], greyDk);
  limb([8.7, -0.5, 17.4], [9.6, -1.2, 12.5], 1.7, 1.4, grey);
  limb([9.2, -2.2, 16.5], [9.8, -2.2, 13.5], 0.3, 0.3, cyan);
  ell([1.6, 1.4, 1.2], [9.8, -1.3, 11.6], greyDk);
  for (a = [-40, -10, 20, 50]) {
    d = [sin(a) * 1.4, -cos(a) * 0.4 - 0.4, -2.6];
    p = [9.8 + sin(a) * 1.2, -1.3 - cos(a) * 0.4, 10.8];
    limb(p, p + d, 0.45, 0.35, cyan);
  }
}

// Monitor head: a chunky grey box with an orange screen and the chat-bubble face.
translate([0, -0.5, 32.5]) rotate([-14, 0, 0]) {
  color(grey) hull() for (x = [-6.4, 6.4], z = [-4.2, 4.2]) translate([x, 0, z]) rotate([90, 0, 0]) cylinder(h = 5, r = 1, center = true, $fn = 14);
  color(grey) hull() for (x = [-3.6, 3.6], z = [-2.4, 2.4]) translate([x, 3, z]) rotate([90, 0, 0]) cylinder(h = 2, r = 1, center = true, $fn = 12);
  // Screen.
  color(screen) translate([0, -2.8, 0]) cube([11.6, 0.6, 7.6], center = true);
  color(screenDk) translate([3.5, -3.05, -2.2]) rotate([0, 35, 0]) cube([8, 0.3, 1.2], center = true);
  // Lavender chat bubble with a tail, two dot eyes and a smile.
  color(bubble) hull() for (x = [-3, 3], z = [-1.6, 1.6]) translate([x, -3.2, z]) rotate([90, 0, 0]) cylinder(h = 0.3, r = 1, center = true, $fn = 14);
  color(bubble) translate([-2.4, -3.2, -2.5]) rotate([90, 0, 0]) cylinder(h = 0.3, r = 1.2, center = true, $fn = 3);
  mirror_x() color(ink) translate([1.5, -3.45, 0.6]) rotate([90, 0, 0]) cylinder(h = 0.3, r = 0.55, center = true, $fn = 12);
  color(ink) translate([0, -3.45, -0.3]) rotate([90, 0, 0]) difference() {
    cylinder(h = 0.3, r = 1.3, center = true, $fn = 18);
    cylinder(h = 1, r = 0.85, center = true, $fn = 18);
    translate([0, 1.2, 0]) cube([3, 2.4, 1], center = true);
  }
  // Orange vent strip on the back.
  color(greyDk) translate([0, 4.05, 0.6]) cube([6, 0.3, 3], center = true);
  color(screen) translate([0, 4.1, -2.4]) cube([4.4, 0.4, 1], center = true);
  // Status light on the bezel.
  color(cyan) translate([5.6, -2.9, -4.2]) sphere(0.4, $fn = 8);
}

// Lightning bolts crackling around the body: zig-zag strips.
module zap(p, rot, s) {
  color(bolt) translate(p) rotate(rot) scale(s) {
    pts = [[0, 0], [2, 1.5], [1.4, 2], [4, 4], [3.2, 4.4], [6, 7]];
    for (i = [0 : len(pts) - 2]) hull() {
      translate([pts[i][0], 0, pts[i][1]]) sphere(0.75, $fn = 8);
      translate([pts[i + 1][0], 0, pts[i + 1][1]]) sphere(0.6, $fn = 8);
    }
  }
}
mirror_x() {
  zap([8, 1, 27], [0, -10, 0], 1);
  zap([10, 1, 19], [0, 25, 0], 0.9);
  zap([11, 0.5, 13], [0, 50, 10], 0.7);
}
