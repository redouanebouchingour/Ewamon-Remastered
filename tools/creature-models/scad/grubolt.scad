// Grubolt: a grey-blue armoured pill-bug grub standing upright. Its back is a column of overlapping steel-blue plates
// that fan round a curl (horizontal bands down the back, near-vertical strips over the top) and arch forward as a
// hood over a pale grey side-on head with one beady black eye per side and little mandibles. A pale ribbed belly
// with two pairs of small arms, one pair of stubby legs, and the rear end curling out to the creature's left into a
// short plated roll with a striped drill bit pointing up.
//
// Checklist (front sheet, x = sheet x):
//   shell plates   x -16..10, z 6..40, blue [0.42, 0.51, 0.58], dark seams; hood over the head x -16..-7, z 32..39.5
//   head           x -18..-7, z 23.5..32.5, pale grey, rounded, blunt snout forward-left, mouth line z 25.5
//   eye            (-10.5, 27.6) r 1.4, black bead with a small highlight; the far eye mirrored on the head
//   mandibles      x -14..-11, z 19..23, pale little prongs under the mouth
//   belly          x -10..5, z 3..25, pale grey with dark rib grooves every ~4
//   arms           near pair at x -3..2 (z 17..23 and 10..17), far pair peeking at x -13..-9 (z 11..17)
//   legs           near x 2..6, far x -7..-4, z 0..5
//   tail roll      x 5..17, z 3..18 (blue plates, grey underside); drill x 11..18.5, z 13..24, banded grey
// Pose: the plated curl and head are turned 30 degrees to the creature's right (the art is near side-on), the belly,
// arms and legs face -Y. Back: horizontal plate bands z 5.5 / 11.5 / 18.5 / 25.5 / 33, head on the right, drill left.
include <lib.scad>

plateC = [0.38, 0.47, 0.55];
seamC = [0.18, 0.2, 0.24];
headC = [0.62, 0.64, 0.68];
neckC = [0.42, 0.44, 0.49];
bellyC = [0.55, 0.57, 0.61];
grooveC = [0.3, 0.31, 0.35];
limbC = [0.52, 0.54, 0.58];
limbDark = [0.32, 0.34, 0.38];
fangC = [0.74, 0.77, 0.8];
inkC = [0.2, 0.21, 0.25];
drillC = [0.6, 0.62, 0.66];
drillDark = [0.27, 0.29, 0.34];
eyeC = [0.03, 0.03, 0.05];

CURL = -30;              // the shell and head turn this far about Z towards the creature's right
C = [-7, 21];            // the plates fan round this (y, z) point in the curl frame
SEAMS = [-100, -44, -28, -6, 17, 40, 66, 94, 190];

module sph(r, p, fn = 40) { translate(p) scale(r) sphere(1, $fn = fn); }

// The plated shell volume in the curl frame: the dorsal column (cut open at the front for the belly) and the hood.
module shellVol(g = 0) {
  intersection() {
    hull() {
      sph([10 + g, 9.5 + g, 19.5 + g], [0, 1.5, 19.5], 44);
      sph([7.2 + g, 11 + g, 7 + g], [0, -8, 32.5], 36);
    }
    union() {
      translate([-30, -4.5, -5]) cube([60, 40, 60]);
      translate([-30, -30, 32.2]) cube([60, 60, 20]);
    }
  }
}
// One plate's wedge round C, between two seam angles (degrees from +Y towards +Z), shrunk to leave a groove.
module wedge(a0, a1, gap = 0.3) {
  translate([0, C[0], C[1]]) rotate([90, 0, 90]) linear_extrude(height = 40, center = true)
    offset(delta = -gap) polygon(concat([[0, 0]], [for (a = [a0 : 6 : a1]) 45 * [cos(a), sin(a)]], [45 * [cos(a1), sin(a1)]]));
}

rotate([0, 0, CURL]) {
  // Shell: dark core showing in the grooves, then each plate.
  color(seamC) shellVol(-0.6);
  for (i = [0 : len(SEAMS) - 2]) color(plateC) intersection() { shellVol(0); wedge(SEAMS[i], SEAMS[i + 1]); }

  // Neck under the hood, joining the head to the body.
  ell([6.2, 7, 5.6], [0, -6.5, 27.3], neckC);
  // Head: a rounded pale skull with a blunt snout forward and a little low.
  color(headC) hull() {
    sph([4.4, 5.6, 4.6], [0, -13.8, 28], 32);
    sph([3.4, 2.8, 2.9], [0, -17.2, 26.4], 24);
  }
  // Mouth line across the front of the snout.
  color(inkC) intersection() {
    hull() { sph([4.65, 5.85, 4.85], [0, -13.8, 28], 32); sph([3.65, 3.05, 3.15], [0, -17.2, 26.4], 24); }
    translate([-10, -30, 25.2]) cube([20, 15.5, 0.55]);
  }
  mirror_x() {
    // Beady black eyes on the sides of the head.
    eye([3.9, -14.5, 28.3], 1.4, iris = eyeC, sclera = eyeC, pupil = eyeC, yaw = 70, shine = true);
    // Mandibles: little pale prongs under the mouth.
    chain([[1.4, -17.4, 24.6], [1.9, -18.3, 23], [1.2, -18.2, 21.4]], [0.65, 0.5, 0.25], fangC);
  }
}

// Belly: pale and ribbed, facing -Y.
module bellyVol(g = 0) {
  hull() {
    sph([7.8 + g, 6 + g, 5.5 + g], [0, -3.8, 7], 36);
    sph([8.2 + g, 6.3 + g, 6 + g], [0, -4.2, 13.5], 36);
    sph([7.2 + g, 5.8 + g, 5 + g], [0, -4, 20], 36);
  }
}
color(bellyC) bellyVol();
color(grooveC) intersection() {
  bellyVol(0.25);
  for (z = [3.6, 7.6, 11.6, 15.6, 19.6, 23]) translate([-12, -20, z]) cube([24, 16.5, 0.6]);
}

// Two pairs of little arms on the chest, and the stubby legs.
mirror_x() {
  chain([[6, -5.5, 21.5], [7.4, -9, 19.6], [6.2, -11.2, 17.8]], [1.5, 1.25, 1], limbC);
  spike([6.2, -11.2, 17.8], [-0.6, -1.4, -1], 0.7, 0.1, limbDark);
  chain([[6, -6, 15.5], [7.4, -9.4, 13.8], [6.2, -11.6, 12]], [1.5, 1.25, 1], limbC);
  spike([6.2, -11.6, 12], [-0.6, -1.4, -1], 0.7, 0.1, limbDark);
  limb([5.2, -2.5, 5.5], [5.6, -3.2, 1.4], 2, 1.5, limbC);
  ell([1.7, 2.3, 1.1], [5.6, -4, 1.1], limbDark);
}

// Tail roll: the rear end curling out to the creature's left, plated on top, grey underneath.
TAIL = [[[6.5, 5.5, 6], [5, 8, 8.5]], [[5.5, 5, 5.5], [9, 7.5, 10.5]], [[4.5, 4.2, 4.6], [12, 5, 12.5]]];
module tailVol(g = 0) { for (i = [0 : 2]) sph(TAIL[i][0] + [g, g, g], TAIL[i][1], 32); }
color(plateC) tailVol();
// Grooves between the roll's plates: thin slabs across the chain at each junction and through the big first plate.
TG = [[TAIL[0][1] + [-1.5, 0, 0], [1, 0, 0.1]], [(TAIL[0][1] + TAIL[1][1]) / 2 + [0.6, 0, 0], TAIL[1][1] - TAIL[0][1]],
      [(TAIL[1][1] + TAIL[2][1]) / 2 + [0.4, 0, 0], TAIL[2][1] - TAIL[1][1]]];
color(seamC) intersection() {
  tailVol(0.2);
  for (t = TG) translate(t[0]) rotate(_dir_rot(t[1])) cylinder(h = 0.55, r = 12, center = true, $fn = 16);
}

// Drill bit: a banded cone from the end of the roll, pointing up and out.
DB = [13, 5, 15.5];
DT = [16.5, 6.5, 24];
translate(DB) rotate(_dir_rot(DT - DB)) {
  L = norm(DT - DB);
  for (k = [0 : 4]) color(k % 2 == 0 ? drillC : drillDark) translate([0, 0, k * L / 5 - 0.6])
    cylinder(h = L / 5 + 0.1, r1 = 3 * (1 - k / 5) + 0.15, r2 = 3 * (1 - (k + 1) / 5) + 0.15, $fn = 18);
}
