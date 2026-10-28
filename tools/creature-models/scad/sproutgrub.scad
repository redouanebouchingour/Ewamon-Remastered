// Sproutgrub: a sleepy grub tucked into its own fat green segmented body like a blanket; a brown seed-head with a
// pale yellow-green face peeks out under a leafy hood, a two-leaf sprout on top, yellow spots along its sides.
include <lib.scad>

green = [0.42, 0.62, 0.16];
greenDk = [0.3, 0.47, 0.1];
greenHi = [0.55, 0.74, 0.22];
spot = [0.98, 0.76, 0.12];
brown = [0.5, 0.3, 0.14];
face = [0.9, 0.95, 0.5, NOGLOW];
sprout = [0.68, 0.84, 0.3];
ink = [0.12, 0.15, 0.06];

// Body segments: big rounded rings stepping back and down, with a darker seam ring between each.
segs = [[0, 0.5, 11, 11, 10.5], [1, 5.5, 10, 10.5, 9.5], [2, 10, 8.5, 9.5, 8], [3, 14, 6.5, 8, 6.5]];
for (s = segs) {
  ell([s[3], 4.2, s[2]], [0, s[1], s[4]], green);
  ell([s[3] * 0.97, 4.6, s[2] * 0.96], [0, s[1] + 2.4, s[4] - 0.2], greenDk);
}
// Yellow spots on both flanks and the top of each segment.
for (s = segs) mirror_x() {
  translate([s[3] * 0.97, s[1] - 0.5, s[4] + 1]) rotate([0, 90, 0]) color(spot) scale([1.8, 1.8, 0.7]) sphere(1, $fn = 16);
}
for (s = [segs[1], segs[2]]) color(spot) translate([0, s[1] - 0.5, s[4] + s[2] * 1.0]) scale([1.7, 1.7, 0.6]) sphere(1, $fn = 14);
// A stubby tail tip at the back.
ell([4, 3.5, 4], [0, 18, 4], green);

// Head: a brown seed with a yellow-green face mask, nestled in the front segment.
ell([7.5, 6.5, 7], [0, -5, 10], brown);
// Face mask: a heart-ish pale patch (brown widow's peak left on the forehead).
ell([5.6, 2, 4.6], [0, -10.2, 9.5], face);
color(brown) translate([0, -11.4, 13.5]) rotate([90, 0, 0]) cylinder(h = 2, r1 = 1.6, r2 = 1.2, center = true, $fn = 3);
// Closed sleepy eyes: little downward arcs.
mirror_x() color(ink) translate([2.6, -11.9, 10]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.5, r = 1.4, center = true, $fn = 20);
  cylinder(h = 1, r = 0.9, center = true, $fn = 20);
  translate([0, 1.2, 0]) cube([4, 2.4, 2], center = true);
}
// Brown stubby forelegs/paws tucked under the face.
mirror_x() ell([1.6, 1.3, 1.2], [3.8, -11, 4.5], brown);
ell([1.4, 1.1, 1], [-6.5, -10, 6.5], brown);

// Leafy hood: the front segment folds over the head like a blanket edge.
color(greenHi) translate([0, -7.5, 10.5]) rotate([80, 0, 0]) scale([1.05, 1.1, 1]) rotate([0, 0, 145]) rotate_extrude(angle = 250, $fn = 36) translate([8, 0]) scale([1, 1.4]) circle(2.6, $fn = 14);
color(green) translate([0, -4.5, 10.5]) rotate([80, 0, 0]) scale([1.05, 1.1, 1]) rotate([0, 0, 135]) rotate_extrude(angle = 270, $fn = 36) translate([8.5, 0]) circle(2.6, $fn = 12);
// Blanket flap wrapping across the bottom of the face.
color(green) translate([0, -8.5, 3.8]) rotate([10, 0, 0]) scale([9, 4, 3.6]) sphere(1, $fn = 28);

// Sprout: a stem and two leaves out of the top of the head.
limb([0, -6, 16.5], [0, -6.5, 22], 0.8, 0.6, sprout);
petal([3.6, 0.9, 2], [-3.2, -6.5, 23.4], [-20, -20, 0], [0.75, 0.9, 0.35]);
petal([3.6, 0.9, 2], [3.2, -6.5, 24], [-20, 25, 0], [0.75, 0.9, 0.35]);
color(greenDk) translate([0, -6.5, 22.2]) sphere(0.6, $fn = 10);
