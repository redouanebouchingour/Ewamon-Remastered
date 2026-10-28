// Mismagmen: Miscarmen grown into a ghostly witch, a broad white wide-brimmed hat crowned and edged with olive-yellow
// spiky bursts, a lavender face with sharp blue-and-yellow eyes under the brim, a white collar cape with a teal
// jewel, a teal earring, and a skirt of long pale tentacle tendrils with olive-yellow tips.
include <lib.scad>

ghost = [0.78, 0.76, 0.92];
ghostDk = [0.62, 0.6, 0.78];
white = [0.97, 0.97, 1];
olive = [0.72, 0.7, 0.24];
oliveLt = [0.9, 0.88, 0.32];
teal = [0.15, 0.65, 0.65];
dark = [0.12, 0.1, 0.16];

module burst(p, s, rot = [0, 0, 0]) {
  translate(p) rotate(rot) scale(s * 1.4) {
    color(olive) scale([1.4, 1.4, 1]) sphere(1.2, $fn = 12);
    spike([0, 0, 0], [0, 0, 4], 1.1, 0.1, oliveLt);
    for (a = [0 : 72 : 359]) spike([0, 0, 0.3], [2.4 * cos(a), 2.4 * sin(a), 2.2], 0.8, 0.1, a % 144 == 0 ? oliveLt : olive);
  }
}

// Tentacle skirt: eight long tendrils curling out, olive tips.
for (i = [0 : 7]) {
  a = i * 45 + 22.5;
  ca = cos(a); sa = sin(a);
  r0 = 3.5;
  pts = [[r0 * ca, r0 * sa, 12], [5.5 * ca, 5.5 * sa, 6], [7.5 * ca, 7.5 * sa, 2], [9.5 * ca, 9.5 * sa, 1], [10.5 * ca, 10.5 * sa, 3.5]];
  chain([for (k = [0 : 3]) pts[k]], [1.9, 1.6, 1.3, 1.1], i % 2 == 0 ? white : ghost);
  limb(pts[3], pts[4], 1.1, 0.4, olive);
}

// Cape body: a white bell over the tendrils, darker lavender inner folds.
color(white) hull() {
  translate([0, 0, 20]) scale([3.6, 3.2, 1.6]) sphere(1, $fn = 24);
  translate([0, 0, 11]) scale([6.5, 6, 1.6]) sphere(1, $fn = 28);
}
for (a = [-50, 0, 50, 130, 180, 230]) color(ghostDk) rotate([0, 0, a - 90]) hull() {
  translate([3.4, 0, 19]) sphere(0.3, $fn = 8);
  translate([6.4, 0, 11]) sphere(0.5, $fn = 8);
}
// Collar points and the teal jewel.
mirror_x() petal([2.6, 0.8, 1.2], [2, -2.8, 20.2], [0, 30, -20], white);
color(teal) translate([0, -3.6, 19.6]) scale([1.3, 0.8, 1.5]) sphere(1, $fn = 14);
color([0.6, 0.95, 0.95]) translate([0.3, -4.4, 20]) sphere(0.4, $fn = 8);

// Head: lavender, under the hat brim.
ell([6, 5, 4.4], [0, -0.3, 24.2], ghost);
// Eyes: narrow and sharp, blue iris rim on yellow.
mirror_x() translate([2.5, -4.7, 24.6]) rotate([0, 0, -18]) rotate([0, -12, 0]) scale(1.35) {
  color(dark) scale([1.7, 0.6, 1]) sphere(1, $fn = 16);
  color([0.98, 0.85, 0.15]) translate([0, -0.3, -0.1]) scale([1.3, 0.5, 0.75]) sphere(1, $fn = 14);
  color([0.2, 0.4, 0.85]) translate([-0.3, -0.6, -0.1]) scale([0.55, 0.3, 0.6]) sphere(1, $fn = 10);
}
// Small blue mouth.
color([0.3, 0.5, 0.85]) translate([0, -5, 22.6]) scale([1.1, 0.4, 0.4]) sphere(1, $fn = 10);
// Teal earring.
color(teal) translate([-5.6, -1, 21.6]) scale([0.6, 0.6, 0.9]) sphere(1, $fn = 10);

// Witch hat: wide flat brim, a cone crown bent back, spiky bursts around it.
translate([0, 0, 27.5]) {
  color(white) scale([12.5, 10.5, 1.7]) sphere(1, $fn = 40);
  color(ghostDk) translate([0, 0, -0.9]) scale([12, 10, 0.9]) sphere(1, $fn = 40);
  color(white) hull() {
    translate([0, 0.5, 0.5]) scale([5, 5, 1]) sphere(1, $fn = 24);
    translate([0, 3, 7]) sphere(1.6, $fn = 14);
  }
  limb([0, 3, 7], [0, 6, 9.5], 1.6, 0.5, white);
  burst([0, 6.3, 10], 1.1);
  burst([-4, -0.5, 3], 0.9, [0, -30, 0]);
  burst([4.5, 1, 3], 0.9, [0, 30, 0]);
  burst([10.5, 0, 0.5], 0.8, [0, 70, 0]);
  burst([-10.5, 1, 0.5], 0.8, [0, -70, 0]);
  burst([6, -7, 0.5], 0.7, [-40, 30, 0]);
  burst([-1, 8.5, 0.5], 0.7, [50, 0, 0]);
}
