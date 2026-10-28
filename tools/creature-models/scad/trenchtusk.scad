// Trenchtusk: Scraphog rebuilt as a siege engine. A heavy gunmetal boar under a ribbed armour dome with gold seams,
// a crenellated lookout turret with a gold visor on its shoulders, slab-plated legs banded in gold, and two huge
// curved steel tusks sweeping forward from a plated snout with glowing yellow eyes.
include <lib.scad>

metal = [0.27, 0.27, 0.27];
plate = [0.4, 0.4, 0.38];
plateHi = [0.52, 0.52, 0.5];
gold = [0.86, 0.68, 0.14];
steel = [0.74, 0.75, 0.78];
steelDk = [0.5, 0.51, 0.55];
eyeC = [1, 0.85, 0.15];
dark = [0.14, 0.14, 0.14];

// Body core.
ell([9, 12, 8], [0, 1, 14], metal);
// Armour dome: ribbed segments along the length, gold seams between them.
for (i = [0 : 4]) {
  y = -6 + i * 4;
  w = 10.4 - abs(i - 2) * 0.8;
  color(i % 2 == 0 ? plate : plateHi) translate([0, y, 14]) scale([w, 2.4, 9.4 - abs(i - 2) * 0.7]) difference() {
    sphere(1, $fn = 32);
    translate([0, 0, -1.25]) cube(2.5, center = true);
  }
  if (i > 0) color(gold) translate([0, y - 2, 14]) rotate([90, 0, 0]) scale([w - 0.3, 9.2 - abs(i - 2.5) * 0.7, 1])
    difference() { cylinder(h = 0.5, r = 1, center = true, $fn = 32); translate([0, -1.25, 0]) cube([2.5, 2.5, 1], center = true); }
}
// Gold seam along the spine.
color(gold) translate([0, 2, 23]) rotate([90, 0, 0]) scale([0.5, 0.6, 1]) cylinder(h = 18, r = 1, center = true, $fn = 8);
// Lower skirt plates along the flanks.
mirror_x() for (y = [-6, -1, 4, 9]) {
  color(plate) translate([9.6, y, 9.5]) rotate([0, 10, 0]) cube([1.4, 4.4, 5], center = true);
  color(gold) translate([10.2, y, 7.2]) rotate([0, 10, 0]) cube([1.2, 4.4, 0.7], center = true);
}
// Exhaust piston tail.
limb([0, 12, 12], [0, 16, 10], 1.3, 1.1, steelDk);
color(gold) translate([0, 14, 11]) rotate([60, 0, 0]) cylinder(h = 1, r = 1.6, center = true, $fn = 14);

// Turret on the shoulders: a squat tower with crenellations and a gold visor slit.
color(plate) translate([0, -5, 23]) cylinder(h = 5, r1 = 4.2, r2 = 3.6, $fn = 16);
for (a = [0 : 60 : 300]) color(plateHi) translate([3.4 * cos(a), -5 + 3.4 * sin(a), 28.6]) cube([1.6, 1.6, 1.8], center = true);
color(gold) translate([0, -8.7, 26]) scale([2.8, 0.7, 0.7]) sphere(1, $fn = 14);
color(eyeC) translate([0, -9.2, 26]) scale([1.6, 0.4, 0.35]) sphere(1, $fn = 10);

// Head: a blunt armoured wedge with cheek guards, yellow eyes, and the great tusks.
blob([[[6.4, 5.4, 5.6], [0, -11.5, 13.5]], [[4.6, 4, 4], [0, -16, 11.4]]], metal);
color(plateHi) translate([0, -12, 17.6]) rotate([-18, 0, 0]) scale([5.6, 4.4, 1.6]) sphere(1, $fn = 20);
color(gold) translate([0, -15.8, 16.6]) rotate([-30, 0, 0]) scale([4.2, 0.5, 0.6]) sphere(1, $fn = 14);
// Snout cap.
color(plate) translate([0, -18.4, 10.6]) rotate([90, 0, 0]) cylinder(h = 2, r1 = 2.8, r2 = 2.4, center = true, $fn = 16);
mirror_x() color(dark) translate([1.1, -19.5, 10.6]) scale([0.5, 0.3, 0.7]) sphere(1, $fn = 8);
mirror_x() {
  color(dark) translate([2.8, -16.6, 14.4]) rotate([0, -15, -30]) scale([1.9, 0.8, 1.1]) sphere(1, $fn = 12);
  color(eyeC) translate([2.8, -17.2, 14.4]) rotate([0, -15, -30]) scale([1.5, 0.6, 0.7]) sphere(1, $fn = 12);
  color(plate) translate([5.2, -12, 12]) rotate([0, 0, -20]) scale([1.2, 3.4, 3.6]) sphere(1, $fn = 14);
  color(gold) translate([5.6, -12.4, 9]) rotate([0, 0, -20]) scale([1.2, 2.8, 0.6]) sphere(1, $fn = 12);
  // Tusk: steel crescent sweeping out, forward and up, with a gold collar at the root.
  color(gold) translate([3.4, -16.4, 9.6]) rotate([90, 0, -30]) cylinder(h = 1.6, r = 2, center = true, $fn = 14);
  chain([[3.4, -16.4, 9.6], [6.6, -20, 8.6], [9.4, -22.6, 11], [10.6, -23, 15], [10.4, -21.8, 19]],
        [1.8, 1.7, 1.4, 0.9, 0.12], steel);
  chain([[3.6, -16.8, 8.8], [6.6, -20.4, 7.9], [9.5, -23, 10.4]], [1.0, 0.9, 0.6], steelDk);
}

// Legs: four slab-plated pistons with gold bands and blocky hooves.
mirror_x() for (y = [-6, 8]) {
  limb([6, y, 11], [6.4, y - 0.4, 3], 2.6, 2.4, metal);
  color(plate) translate([6.6, y - 0.4, 8.5]) cube([5, 5.4, 6], center = true);
  color(gold) translate([6.6, y - 0.4, 5.2]) cube([5.4, 5.8, 1.2], center = true);
  color(plateHi) translate([6.6, y - 1, 1.5]) cube([5.2, 6, 3], center = true);
  for (x = [-1.4, 1.4]) color(dark) translate([6.6 + x, y - 4, 0.8]) cube([1.6, 1, 1.6], center = true);
}
