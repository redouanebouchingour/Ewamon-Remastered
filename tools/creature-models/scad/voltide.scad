// Voltide: Glimfin grown into a sleek electric anglerfish. A long cyan body with a deep blue back, yellow lightning
// markings, swept fins, a forked tail and a crackling yellow lure hanging before its jaws. It swims upright-ish,
// resting on its belly fins.
include <lib.scad>

cyan = [0.25, 0.7, 0.85];
cyanHi = [0.6, 0.9, 0.95];
blue = [0.12, 0.32, 0.7];
navy = [0.08, 0.18, 0.45];
finC = [0.5, 0.85, 0.9];
yellow = [1, 0.84, 0.2];
yellowHi = [1, 0.97, 0.65, GLOW];
dark = [0.05, 0.07, 0.15];

// Body: a torpedo along Y, head forward (-Y), tilted nose-up a little.
blob([[[6.5, 9.5, 8.5], [0, -6, 17]], [[5.8, 7, 7], [0, 3, 16]], [[3, 4, 3.5], [0, 12, 15]]], cyan);
// Blue back.
color(blue) intersection() {
  hull() {
    translate([0, -6, 17.3]) scale([6.6, 9.6, 8.6]) sphere(1, $fn = 28);
    translate([0, 3, 16.3]) scale([5.9, 7.1, 7.1]) sphere(1, $fn = 28);
    translate([0, 12, 15.2]) scale([3.1, 4.1, 3.6]) sphere(1, $fn = 20);
  }
  translate([0, 0, 30]) cube([30, 50, 22], center = true);
}
// Pale belly.
blob([[[5, 7, 3], [0, -6, 10.5]], [[4, 6, 2.5], [0, 3, 11]]], cyanHi);
// Lower jaw jutting forward with little fangs.
blob([[[5, 3, 2], [0, -13, 12]], [[4, 2, 1.5], [0, -15, 12.5]]], cyan);
color(dark) translate([0, -14.5, 13.8]) scale([4.4, 2.2, 0.5]) sphere(1, $fn = 20);
mirror_x() for (x = [1.2, 3]) spike([x, -15.8, 13.4], [0, 0, 1.4], 0.4, 0.05, "white");

// Fierce yellow eyes.
mirror_x() eye([4.6, -12.3, 18], 2.3, iris = yellow, pupil = dark, sclera = yellow, yaw = -30);
mirror_x() color(navy) translate([4.4, -12.8, 20.3]) rotate([0, -20, -30]) scale([2.8, 0.7, 0.6]) sphere(1, $fn = 12);

// Lightning markings along the flanks.
module bolt(p, s, flip = 1) {
  color(yellow) translate(p) rotate([0, 0, flip * 90]) scale([s, s, s]) linear_extrude(0.8, center = true)
    polygon([[-2, 1], [0.3, 1], [-0.3, 0.1], [2, 0.3], [-0.8, -1.6], [-0.1, -0.4], [-2.2, -0.5]]);
}
mirror_x() {
  translate([6.1, -2, 16]) rotate([0, 90, 0]) rotate([0, 0, 90]) bolt([0, 0, 0], 1.6);
  translate([5.2, 6, 15.5]) rotate([0, 90, 0]) rotate([0, 0, 90]) bolt([0, 0, 0], 1.1);
}
// Yellow chevrons down the back.
for (i = [0 : 2]) mirror_x() color(yellow) translate([3.2, -6 + i * 6, 23.6 - i * 1.4]) rotate([-5, 40, 20]) scale([2.6, 0.9, 0.5]) sphere(1, $fn = 10);

// Dorsal fin: tall, swept back, spiky.
for (i = [0 : 2]) color(navy) translate([0, -4 + i * 5, 24 - i * 1.5]) rotate([-45, 0, 0]) scale([0.9, 4, 9 - i * 2]) sphere(1, $fn = 14);
// Pectoral fins: big swept wings with yellow roots.
mirror_x() {
  color(finC) translate([9.5, -1, 15]) rotate([0, -15, 30]) scale([7.5, 3.5, 0.8]) sphere(1, $fn = 20);
  color(blue) translate([12, 1.5, 15.7]) rotate([0, -15, 30]) scale([4, 1.6, 0.9]) sphere(1, $fn = 14);
  ell([2, 1.2, 1.4], [6.8, -2, 15], yellow);
}
// Pelvic fins it rests on.
mirror_x() color(blue) translate([4, -3, 6]) rotate([25, 35, 0]) scale([1, 2.6, 4.8]) sphere(1, $fn = 14);
// Anal fin.
color(blue) translate([0, 8, 8.5]) rotate([30, 0, 0]) scale([0.8, 2.6, 4.5]) sphere(1, $fn = 14);

// Forked tail.
for (s = [-1, 1]) color(finC) translate([0, 17, 15]) rotate([s * 40 - 10, 0, 0]) translate([0, 4, 0]) scale([0.9, 5.5, 2.4]) sphere(1, $fn = 16);
ell([1, 2, 2], [0, 15, 15], blue);

// Angler stalk from the brow arching forward to a glowing lure.
lure = [-2, -19, 26.5];
chain([for (t = [0 : 0.125 : 1]) [-2 * t, -4 - 15 * t, 25 + 9 * sin(t * 180) + 4 * t]], [for (t = [0 : 8]) 0.7 - t * 0.03], navy);
ell([2.6, 2.6, 2.6], lure, yellow);
ell([1.4, 1.4, 1.4], lure + [-0.7, -1.5, 0.8], yellowHi);
for (d = [[-1, -0.3, 1], [1, -0.5, 1.2], [-1.2, -0.3, -1], [0.3, -1, -1.3], [-1.4, 0, 0.1]]) spike(lure + d * 3, d * 1.6, 0.35, 0.05, yellow);
