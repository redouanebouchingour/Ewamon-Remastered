// Archonosis: a floating archmage with a bone-white mask set with magenta gem eyes, a tall notched purple crown, a
// crimson robe with pointed shoulders over a blue underrobe, a body that trails off into swirling violet wisps and a
// spinning blue vortex orb held in one hand.
include <lib.scad>

mask = [0.93, 0.88, 0.72];
maskShade = [0.75, 0.68, 0.55];
gem = [0.85, 0.2, 0.75];
gemDark = [0.4, 0.06, 0.38];
crown = [0.38, 0.22, 0.55];
crownTrim = [0.6, 0.6, 0.8];
robe = [0.62, 0.12, 0.38];
robeDark = [0.42, 0.08, 0.28];
under = [0.2, 0.28, 0.55];
trim = [0.38, 0.45, 0.75];
wisp = [0.42, 0.28, 0.72];
wispHi = [0.55, 0.55, 0.92];
sleeve = [0.36, 0.25, 0.6];
hand = [0.5, 0.42, 0.7];
orb = [0.4, 0.75, 1];
orbCore = [0.8, 0.95, 1];

module gemEye(p, s, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(gemDark) scale([s * 1.2, 0.5, s * 1.6]) sphere(1, $fn = 10);
    color(gem) translate([0, -0.3, 0]) scale([s * 0.85, 0.5, s * 1.25]) sphere(1, $fn = 10);
  }
}

// Wispy lower body: curling tendrils from under the robe down to the ground.
chain([[0, 0, 16], [-1.5, -0.5, 11], [-5, -1, 7], [-5, -1.5, 3.5], [-1, -2, 1.2], [3.5, -2, 1.5], [5, -2, 3.5]], [3.4, 2.6, 2, 1.6, 1.2, 0.8, 0.3], wisp);
chain([[1.5, 0.5, 15], [3.5, 0.5, 10], [3, -0.5, 6], [6, -1, 4.5], [8.5, -1.5, 6.5]], [2.4, 1.8, 1.4, 0.9, 0.3], wispHi);
chain([[-0.5, 2, 15], [-2, 3.5, 10], [-6.5, 3.5, 8], [-9, 2, 10]], [2.2, 1.6, 1, 0.3], wisp);
chain([[0.5, 1.5, 13], [2, 3.5, 8], [0.5, 5, 4], [3, 6, 2]], [1.8, 1.4, 1, 0.3], wispHi);

// Underrobe: blue, tapering into the wisps.
color(under) translate([0, 0, 13]) cylinder(h = 12, r1 = 3.5, r2 = 5.5, $fn = 28);

// Robe: crimson open coat, flared skirt, a blue hem band, open at the front to show the underrobe.
module coat(r1, r2, h) {
  difference() {
    cylinder(h = h, r1 = r1, r2 = r2, $fn = 36);
    translate([0, 0, -0.1]) cylinder(h = h + 0.2, r1 = r1 - 0.7, r2 = r2 - 0.7, $fn = 36);
    translate([0, -r1, -1]) linear_extrude(height = h + 2, scale = 0.25) square([r1 * 0.9, r1 * 1.2], center = true);
  }
}
translate([0, 0.5, 16]) {
  color(robe) coat(10, 5.6, 14);
  color(trim) coat(10.1, 9.6, 1.3);
}
// Chest: blue underrobe with a magenta gem.
blob([[[5.2, 4, 4], [0, 0, 27]], [[4.6, 3.6, 3], [0, 0.4, 31]]], under);
color(gem) translate([0, -4.3, 29]) scale([0.9, 0.6, 1.4]) sphere(1, $fn = 12);

// High pointed shoulder mantle with trim.
mirror_x() {
  color(robe) hull() {
    translate([2, 0, 33]) sphere(2.4);
    translate([8.5, 0, 33.5]) sphere(1.6);
    translate([7, 0, 28.5]) sphere(2.2);
  }
  spike([8, 0, 33.4], [3, 0, 3], 1.4, 0.1, robe);
  // Tall collar flaring up beside the head.
  color(robeDark) hull() {
    translate([3, 0.5, 33]) sphere(1.4);
    translate([5, 1, 39]) sphere(0.5);
    translate([5, 2.5, 34]) sphere(1);
  }
}

// Sleeves and hands. Viewer's left hand cups the vortex orb; right hand open, held out.
chain([[-7, 0, 31], [-9.5, -1, 26], [-10, -3.5, 23]], [2.2, 2.6, 3], sleeve);
ell([1.8, 1.6, 1.4], [-10, -4.6, 22.2], hand);
chain([[7, 0, 31], [9.5, -1, 26], [10.5, -3, 23]], [2.2, 2.6, 3], sleeve);
ell([1.8, 1.6, 1.4], [10.5, -4.4, 22.2], hand);
mirror([0, 0, 0]) for (a = [-40, 0, 40]) spike([10.5 + sin(a) * 1.2, -5.2, 22.5], [sin(a) * 0.4, -0.6, 1.8], 0.5, 0.15, hand);

// Vortex orb above the left hand: a glowing core inside swirling rings.
translate([-11, -5, 27]) {
  color(orb) sphere(4, $fn = 24);
  color(orbCore) sphere(2.6, $fn = 16);
  for (t = [0, 60, 120]) rotate([t, 30, t * 0.5]) for (a = [0 : 30 : 300])
    limb([5 * cos(a), 5 * sin(a), 0], [5 * cos(a + 30), 5 * sin(a + 30), 0], 0.35, 0.3, wispHi);
}

translate([0, -0.5, 34]) scale(1.35) translate([0, 0, -34]) {
// Head: a bone mask with a pointed chin and a ring of gem eyes.
blob([[[3.6, 3.2, 3.6], [0, -0.5, 37.5]], [[1.6, 1.4, 1.2], [0, -1.8, 33.6]]], mask);
color(maskShade) translate([0, -2, 34.5]) scale([2.2, 1.6, 0.8]) sphere(1, $fn = 14);
mirror_x() {
  gemEye([1.3, -3.7, 37.6], 0.75, -10);
  gemEye([2.5, -2.9, 39.2], 0.55, -30);
  gemEye([2.6, -3.1, 36], 0.5, -30);
}
gemEye([0, -3.2, 40], 0.5, 0);

// Crown: a tall purple fan behind the head, notched at the top, with pale trim and gems.
translate([0, 1.2, 38]) rotate([-8, 0, 0]) {
  color(crown) difference() {
    scale([7.5, 1.8, 8.5]) sphere(1, $fn = 32);
    translate([0, 0, -6]) cube([20, 10, 12], center = true);
    translate([0, 0, 8]) cube([1.6, 6, 4], center = true);
  }
  color(crownTrim) difference() {
    scale([7.9, 1.4, 8.9]) sphere(1, $fn = 32);
    translate([0, 0, -6]) cube([20, 10, 12], center = true);
    translate([0, 0, 8.4]) cube([2.2, 6, 4], center = true);
    scale([7.4, 2, 8.4]) sphere(1, $fn = 32);
  }
  // Gems on the fan, either side of the mask.
  mirror_x() for (g = [[4.2, 2.5], [5.2, 5], [3, 6.2]])
    color(gem) translate([g[0], -1.7, g[1]]) scale([0.6, 0.4, 0.9]) sphere(1, $fn = 10);
}
}
