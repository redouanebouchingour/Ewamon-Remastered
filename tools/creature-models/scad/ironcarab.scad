// Ironcarab: an armoured rhinoceros beetle, a riveted steel-blue shell split by bronze seams, a hooked horn on its
// pronotum, two long curved head horns, glowing orange eyes and six jointed bronze legs.
include <lib.scad>

steel = [0.38, 0.45, 0.55];
steelHi = [0.48, 0.56, 0.66];
steelDark = [0.24, 0.28, 0.35];
bronze = [0.55, 0.47, 0.35];
bronzeDark = [0.36, 0.3, 0.22];
under = [0.28, 0.25, 0.22];
eyeGlow = [1, 0.6, 0.1];
rivet = [0.7, 0.75, 0.8];

// Underbody.
color(under) translate([0, 2, 8]) scale([9.5, 13, 4.5]) sphere(1, $fn = 28);

// Elytra: a long dome sitting on a bronze rim, split down the middle by a bronze seam.
module dome(g = 0) translate([0, 4, 7]) scale([11.5 + g, 13 + g, 12 + g]) sphere(1, $fn = 40);
color(bronze) intersection() { dome(0.25); translate([0, 4, 7.6]) cube([30, 32, 1.6], center = true); }
color(steel) intersection() { dome(); translate([0, 4, 25]) cube([30, 32, 34], center = true); }
// Highlight panels either side of the seam.
mirror_x() color(steelHi) intersection() {
  dome(0.12);
  translate([5, 2, 16]) rotate([0, 10, 0]) scale([2.6, 7, 5]) sphere(1, $fn = 16);
}
// Middle seam and a cross seam in bronze.
color(bronze) intersection() {
  dome(0.2);
  union() {
    translate([0, 4, 20]) cube([0.9, 40, 30], center = true);
    translate([0, -2.5, 20]) rotate([-30, 0, 0]) cube([40, 0.9, 30], center = true);
  }
}
// Rivets along the middle seam.
for (el = [20 : 12 : 80]) mirror_x()
  color(rivet) translate([1.2, 4 + 13 * cos(el) * 0.98, 7 + 12 * sin(el) * 0.98]) sphere(0.45, $fn = 8);

// Pronotum: a steel shield at the front of the shell with a bronze rim.
color(bronze) translate([0, -8, 11]) rotate([-30, 0, 0]) scale([8.6, 5, 6.4]) sphere(1, $fn = 28);
color(steel) translate([0, -8.6, 11.6]) rotate([-30, 0, 0]) scale([8.2, 4.9, 6.2]) sphere(1, $fn = 28);
// Hooked horn rising from the pronotum, curling forward at the tip.
chain([[0, -9, 15], [0, -9.5, 19.5], [0, -8.5, 23], [0, -6, 24.5], [0, -4.5, 23.5]], [2.4, 1.9, 1.4, 0.8, 0.2], steelDark);

// Head, low at the front.
blob([[[5.2, 4, 3.8], [0, -13, 7]], [[3.8, 3.4, 3], [0, -16.5, 6.4]]], [0.42, 0.36, 0.27]);
mirror_x() {
  color(eyeGlow) translate([3.4, -17.2, 8.4]) scale([1.3, 1, 1.2]) sphere(1, $fn = 14);
  color([1, 0.9, 0.5]) translate([3.6, -18.1, 8.8]) sphere(0.45, $fn = 8);
  // Long sickle horns sweeping forward, out and up.
  chain([[4, -14.5, 9], [6.5, -17, 11], [8.5, -19, 15], [9.5, -19, 20], [9, -17.5, 24]], [1.6, 1.4, 1.1, 0.7, 0.2], steelDark);
  // Mandibles.
  chain([[1.4, -17.5, 5], [2.4, -19, 3.6], [1, -19.8, 2.8]], [0.8, 0.6, 0.2], bronzeDark);
}

// Six jointed bronze legs, splayed out.
module leg(hip, knee, foot) {
  limb(hip, knee, 2, 1.7, bronze);
  ell([1.9, 1.9, 1.9], knee, bronzeDark);
  limb(knee, foot, 1.6, 1, bronze);
  for (a = [-30, 30]) spike(foot, [sin(a) * 1.5, -1, -0.6], 0.5, 0.05, bronzeDark);
}
mirror_x() {
  leg([6.5, -6, 6], [11.5, -9.5, 8], [13, -12, 1]);
  leg([8, 1, 6], [13.5, 1, 8], [15.5, 2, 1]);
  leg([7, 8, 6], [12, 12.5, 8], [13.5, 15.5, 1]);
}
