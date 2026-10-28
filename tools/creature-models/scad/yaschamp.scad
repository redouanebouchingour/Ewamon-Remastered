// Yaschamp: a hulking jackal boxer, olive muzzle and ears, a white headband trailing behind, red gloves on its hips,
// black trunks with a Dutch flag patch and a wide squat stance.
include <lib.scad>

fur = [0.45, 0.3, 0.17];
furDk = [0.33, 0.21, 0.12];
furHi = [0.72, 0.48, 0.22];
olive = [0.45, 0.47, 0.18];
oliveDk = [0.32, 0.34, 0.12];
shorts = [0.1, 0.1, 0.12];
shortsHi = [0.3, 0.3, 0.38];
glove = [0.85, 0.08, 0.06];
band = [0.9, 0.9, 0.9];
shoe = [0.08, 0.08, 0.09];
nlRed = [0.75, 0.1, 0.12];
nlBlue = [0.1, 0.2, 0.6];

// Flat vertical ribbon through pts with half-heights hs.
module ribbon(pts, hs, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) scale([0.35, 0.35, 1]) sphere(hs[i], $fn = 12);
    translate(pts[i + 1]) scale([0.35, 0.35, 1]) sphere(hs[i + 1], $fn = 12);
  }
}

// Head: shared by the line. Jackal skull with a long olive muzzle pointing forward, two tall ears.
module jackal_head(p, bandC = band) {
  translate(p) {
    blob([[[3.7, 4.2, 3.6], [0, 0.5, 0.8]], [[2.8, 3, 2.4], [0, -2.5, 0]]], fur);
    // Muzzle, olive.
    blob([[[3, 3.2, 2.2], [0, -2, -1.4]], [[1.3, 2, 1.2], [0, -8.5, -1.2]]], olive);
    ell([0.8, 0.7, 0.6], [0, -10.3, -0.8], [0.1, 0.08, 0.06]);
    color(oliveDk) translate([0, -6, -2.8]) scale([1.8, 3, 0.4]) sphere(1, $fn = 16);
    // Eyes: red, angled.
    mirror_x() eye([2.2, -3.3, 1.2], 0.9, iris = [0.8, 0.08, 0.08], sclera = [1, 0.85, 0.8], yaw = -25);
    mirror_x() color(furDk) translate([2.2, -3.6, 2]) rotate([0, -20, -25]) scale([1.4, 0.5, 0.4]) sphere(1, $fn = 12);
    // Ears.
    mirror_x() {
      color(olive) translate([2.2, 1, 3]) rotate([-8, 18, 0]) scale([1, 0.55, 1]) cylinder(h = 7.5, r1 = 2, r2 = 0.1, $fn = 14);
      color(furDk) translate([2.3, 0.4, 3.4]) rotate([-8, 18, 0]) scale([0.6, 0.3, 1]) cylinder(h = 5.5, r1 = 1.4, r2 = 0.1, $fn = 10);
    }
    // Headband with trailing tails.
    color(bandC) translate([0, 0.5, 1.9]) rotate([8, 0, 0]) scale([0.92, 1.04, 1]) cylinder(h = 1.3, r = 4.15, $fn = 28);
    ribbon([[1.5, 4.2, 2.2], [5, 6.5, 3.2], [9, 7.5, 2.2], [12.5, 8.5, 3.4]], [1, 1.2, 1.1, 0.9], bandC);
    ribbon([[1.5, 4.2, 1.6], [4.5, 7, 0.4], [8, 8.5, -0.8], [11.5, 9.5, 0.2]], [1, 1.1, 1, 0.8], bandC);
  }
}

module body() {
  // Barrel chest and huge shoulders.
  blob([[[9.5, 6, 6.5], [0, 0, 27]], [[7, 5, 5], [0, 0.5, 20]]], fur);
  // Pecs and abs.
  mirror_x() ell([4, 1.8, 3], [3.4, -4.6, 27.5], fur);
  mirror_x() color(furHi) translate([4.2, -6.1, 27.6]) rotate([10, 0, -15]) scale([1.8, 0.4, 1.3]) sphere(1, $fn = 14);
  color(furDk) translate([0, -5.4, 21]) scale([0.3, 0.5, 4]) sphere(1, $fn = 10);
  for (z = [19, 21.5]) color(furDk) translate([0, -5.3, z]) scale([2.6, 0.4, 0.25]) sphere(1, $fn = 10);
  // Shoulder humps.
  mirror_x() ell([4.2, 4, 3.8], [9, 0, 28], fur);
  mirror_x() color(furHi) translate([10, -3.6, 29.5]) rotate([0, 0, -30]) scale([1.6, 0.4, 1.2]) sphere(1, $fn = 14);
  // Back muscle lines.
  color(furDk) translate([0, 5.8, 25]) scale([0.4, 0.5, 5]) sphere(1, $fn = 10);
  mirror_x() color(furDk) translate([4.5, 5.4, 26]) rotate([0, 30, 0]) scale([0.35, 0.5, 4]) sphere(1, $fn = 10);
  // Arms: elbows out, fists on the hips.
  mirror_x() {
    chain([[10.5, 0, 27], [14.5, 0.5, 21.5], [9.5, -1, 16.5]], [3.2, 2.8, 2.4], fur);
    ell([3, 3, 2.8], [9.8, -1.5, 16.2], glove);
    ell([1.6, 1.2, 1.4], [10.6, -3.8, 17], [1, 0.35, 0.3]);
  }
  // Trunks.
  blob([[[7.5, 5.5, 3], [0, 0.5, 15.5]], [[8.5, 5.5, 2.5], [0, 0.5, 13]]], shorts);
  mirror_x() color(shortsHi) translate([7, -3.2, 10.5]) rotate([0, 0, -20]) scale([1.6, 0.6, 1.2]) sphere(1, $fn = 14);
  mirror_x() limb([5.5, 0.5, 13], [9, -0.5, 9], 4, 3.6, shorts);
  // Dutch flag patch on the right leg.
  translate([8.2, -4.1, 10.4]) rotate([0, 0, -20]) {
    color(nlRed) translate([0, 0, 0.8]) cube([2.4, 0.4, 0.8], center = true);
    color(band) cube([2.4, 0.4, 0.8], center = true);
    color(nlBlue) translate([0, 0, -0.8]) cube([2.4, 0.4, 0.8], center = true);
  }
  // Squat legs and black shoes.
  mirror_x() {
    chain([[9, -0.5, 9], [10.5, -1, 4.5], [10, -0.5, 2]], [3.2, 2.6, 2.3], fur);
    blob([[[2.8, 4, 1.4], [10.5, -2.2, 1.3]], [[2.4, 2, 1.6], [10.2, 0.8, 1.6]]], shoe);
    
  }
}

body();
translate([-1.5, -2.5, 35.5]) scale(1.3) jackal_head([0, 0, 0]);
// Neck.
blob([[[4, 3.5, 2], [-1, -1, 32]], [[5, 4, 2], [0, 0, 30]]], fur);
