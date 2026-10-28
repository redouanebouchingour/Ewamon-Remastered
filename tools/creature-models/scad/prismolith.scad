// Prismolith: Lithokrysm's final form, a hunched golem of ochre cobblestone. A great starburst of lilac crystals
// erupts from its back, crystal shards bristle on its forearms, shins and hips, silver geode discs sit on its
// shoulders, and a small plated head peers out with violet eyes.
include <lib.scad>

ochre = [0.66, 0.55, 0.3];
ochreLight = [0.8, 0.7, 0.42];
ochreDark = [0.42, 0.33, 0.2];
crystalC = [0.62, 0.52, 0.66];
crystalLight = [0.8, 0.72, 0.84];
crystalDark = [0.42, 0.33, 0.48];
silver = [0.78, 0.76, 0.8];
silverDark = [0.5, 0.48, 0.52];
violet = [0.45, 0.3, 0.6];

module crystal(p, d, r, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.72, r1 = r * 0.85, r2 = r, $fn = 6);
    translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.05, $fn = 6);
  }
}

// Cobbles scattered over an ellipsoid region: centre c, radii r, list of [az, el].
module cobbles(c, r, pts, s) {
  for (i = [0 : len(pts) - 1]) {
    az = pts[i][0]; el = pts[i][1];
    p = c + [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)];
    color(i % 3 == 0 ? ochreLight : (i % 3 == 1 ? ochre : ochreDark)) translate(p) rotate([0, 90 - el, az]) scale([1, 1, 0.5]) sphere(s, $fn = 10);
  }
}

// Torso: a massive hunched boulder leaning forward.
blob([[[10, 8.5, 8], [0, 1, 21]], [[8, 7, 6.5], [0, -3, 25]], [[7, 6, 5], [0, 1, 14]]], ochreDark);
cobbles([0, 1, 21], [10, 8.5, 8], [for (az = [0 : 36 : 359], el = [-30, 0, 30]) [az + el, el]], 3.3);
// Belly plates.
ell([4, 1.6, 2], [0, -6.6, 15], ochreLight);

// Head (scaled up about its centre and raised so it peeks over the shoulders).
translate([0, -10, 30]) scale(1.3) translate([0, 8, -27]) {
  // Head: small, low and forward, with stacked yellow plates.
blob([[[4.2, 4, 3.6], [0, -8, 27]], [[3, 2.8, 2.4], [0, -11, 25.5]]], ochre);
ell([3.4, 2, 1.6], [0, -10, 29.4], ochreLight);
mirror_x() {
  // Glowing violet eyes on a dark socket, sunk under a hard brow that slants down to the nose.
  eye([2.3, -11.9, 26.9], 1.45, iris = [0.78, 0.5, 1, GLOW], pupil = [0.15, 0.06, 0.22], sclera = [0.24, 0.17, 0.3], yaw = 14,
      flat = 0.5, lid = 0.4, lid_tilt = 30, lid_c = ochreDark, slit = 0.4);
  color(ochre) hull() {
    translate([3.4, -10.4, 28.6]) scale([1.3, 1.2, 0.75]) sphere(1, $fn = 10);
    translate([0.7, -12.2, 27.9]) scale([0.8, 0.9, 0.55]) sphere(1, $fn = 10);
  }
}
ell([1.8, 1, 0.6], [0, -13.4, 24.6], ochreDark);
// Head crest crystals.
mirror_x() crystal([2.4, -8, 29.5], [1.5, 1.5, 4], 0.8, crystalC);

}
// Crystal crown on the head, merging into the back burst.
for (a = [-50, -25, 0, 25, 50]) crystal([a / 25, -9, 33.5], [sin(a) * 3, 1.5, 5.5 - abs(a) / 25], 1.1, a == 0 ? crystalLight : crystalC);

// Back crystal starburst: long lilac shards radiating from the upper back.
burst = [[0, 0, 14], [0, -40, 12], [0, 40, 12], [0, -75, 11], [0, 75, 11], [30, -20, 11], [30, 20, 11],
         [-25, 0, 10], [35, -60, 9], [35, 60, 9], [-20, -45, 9], [-20, 45, 9], [55, 0, 8], [10, -100, 8],
         [10, 100, 8], [60, -40, 7], [60, 40, 7]];
for (i = [0 : len(burst) - 1]) {
  pitch = burst[i][0]; roll = burst[i][1]; len = burst[i][2];
  // Direction: up (+Z) tilted back by `pitch` towards +Y and sideways by `roll`.
  d = [sin(roll), sin(pitch) * cos(roll) + 0.45, cos(pitch) * cos(roll)];
  crystal([0, 5, 26], d / norm(d) * len * 1.7, len > 10 ? 2.2 : 1.8, i % 3 == 0 ? crystalLight : (i % 3 == 1 ? crystalC : crystalDark));
}
ell([2.4, 2, 2.4], [0, 8.5, 27], crystalLight);

// Arms: huge cobbled shoulders with geode discs, thick forearms bristling with shards, knuckles on the ground-ish.
module arm() {
  ell([5, 5, 5], [10.5, -1, 25], ochre);
  // Geode disc on the shoulder.
  translate([14.6, -2, 25.5]) rotate([0, 0, -20]) rotate([0, 90, 0]) {
    color(ochreLight) cylinder(h = 1.2, r = 3.4, $fn = 24);
    color(silverDark) translate([0, 0, 0.8]) cylinder(h = 0.8, r = 2.4, $fn = 20);
    color(silver) translate([0, 0, 1.2]) scale([1, 1, 0.6]) sphere(1.7, $fn = 16);
  }
  limb([11.5, -1, 22], [13.5, -3, 15], 3.4, 3.2, ochre);
  limb([13.5, -3, 15], [13.5, -6, 8], 3.6, 3.8, ochreLight);
  ell([4, 4, 3], [13.5, -6.5, 6], ochre);
  for (k = [-1, 0, 1]) ell([1.3, 1.6, 1.3], [13.5 + k * 2.2, -9.5, 5], ochreLight);
  // Forearm shards pointing out and back.
  crystal([15.5, -3, 13], [4, 2, 2], 1.5, crystalC);
  crystal([16, -4.5, 10], [5.5, 1, 0], 1.5, crystalLight);
  crystal([15.6, -5.5, 7], [5, 0, -1.5], 1.4, crystalC);
  crystal([13, -1, 11], [0.5, 4, 0], 1, crystalDark);
}
mirror_x() arm();

// Legs: short, thick, bowed; knees and hips with crystal clusters.
mirror_x() {
  limb([5.5, 2, 12], [7, 0, 6], 3.8, 3.4, ochre);
  limb([7, 0, 6], [7, -1, 2], 3.4, 3.2, ochreLight);
  ell([3.4, 4.4, 1.8], [7, -2, 1.8], ochre);
  for (k = [-1, 0, 1]) ell([1.1, 1.4, 1], [7 + k * 1.8, -6, 1.2], ochreDark);
  crystal([9.5, 1, 10], [4, 1.5, -1], 1.2, crystalC);
  crystal([9.5, 2, 5], [4, 1, -1.5], 1, crystalLight);
  crystal([8, 4, 6], [1.5, 4, -0.5], 1, crystalDark);
}
