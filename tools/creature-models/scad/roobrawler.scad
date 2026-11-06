// Roobrawler: Joeyjab grown into a muscled kangaroo boxer in an orthodox stance: red tape-wrapped fists up (the lead
// left fist in front of the chest, the rear right one out by the cheek), a gold champion's belt with a round buckle,
// a cream throat, chest and six-pack, big splayed haunches on long cream-clawed feet and a thick tail bound in white
// bandages that curls up at the tip.
//
// Checklist (front sheet x, z; the art is 27.6 x 40):
// - head x -7.5..2.5, z 25..34.5, turned further from the viewer than the body (the far eye a sliver at the left
//   edge), snout down-left to x -7.5, z 26.5; a cream jaw and lower cheek; a smirk curling up at the corner
// - near eye x -3.6..-0.4, z 27..30.2: white behind, a brown iris with a black pupil looking forward, a white glint,
//   a dark slanted brow band over it (angry); far eye a small white sliver at x -7
// - ears long, a V: far tip (-6.2, 39.9), near tip (3.9, 39.5) with a cream inside
// - V torso, the near deltoid at (5.5, 25); cream throat to crotch, faint pec and ab lines; belt z 13..17 with a
//   round buckle (r 2.3) at (-3.7, 15)
// - near arm: elbow out at (7.4, 17.4), fist (2.3, 22.2) with the wrap down the wrist; far arm: elbow (-10.4, 17.8),
//   fist up by the cheek at (-11.2, 23.6)
// - legs splayed, knees out: near knee (5.8, 8.6), foot toes to the viewer at x 2.3..7.7; far knee (-9.6, 9.6), foot
//   from a raised heel (-5.5, 4.5) out to the toes at (-12, 2); three cream claws per foot
// - tail from behind the near leg: bandaged x 7..12.6, z 10..15, the fur tip curling up to (11.3, 20.6)
// - back: muscled back (spine groove, shoulder blades), the belt's plates, the bandaged tail out to the creature's left
include <lib.scad>

fur = [0.85, 0.58, 0.24];
furDk = [0.73, 0.46, 0.17];
furDp = [0.56, 0.37, 0.16];
cream = [0.98, 0.87, 0.61, NOGLOW];
creamDk = [0.86, 0.69, 0.4];
earIn = [0.98, 0.82, 0.6, NOGLOW];
red = [0.79, 0.24, 0.17, NOGLOW];
redDk = [0.58, 0.17, 0.13];
gold = [0.95, 0.71, 0.02, NOGLOW];
goldHi = [0.98, 0.82, 0.12, NOGLOW];
goldDk = [0.72, 0.5, 0.04];
bandage = [0.95, 0.91, 0.85, NOGLOW];
bandageDk = [0.77, 0.66, 0.52];
ink = [0.17, 0.15, 0.14];
iris = [0.46, 0.24, 0.09];
claw = [0.98, 0.87, 0.61, NOGLOW];

// A point read off the front sheet at depth y, with the camera's 10 degree tilt undone (parts further back sit higher
// on the sheet) and the near toes' lift taken off so the feet stand on z = 0.
function S(sx, sz, y) = let(x = (sx - 0.5 * y) / 0.866, d = -0.5 * x + 0.866 * y) [x, y, sz - 0.17 * d - 1.5];

// ---- Torso: a V of chest and waist over a broad pelvis. `g` grows every radius (paint layers).
module torso(g = 0) {
  hull() {
    translate([0, 0.2, 20.4]) scale([6 + g, 4.3 + g, 3.6 + g]) sphere(1, $fn = 32);
    translate([0, 0.4, 23]) scale([5.2 + g, 3.8 + g, 2.4 + g]) sphere(1, $fn = 28);
    translate([0, 0.5, 14.2]) scale([4.2 + g, 3.4 + g, 2.2 + g]) sphere(1, $fn = 28);
  }
  hull() {
    translate([0, 0.5, 14.2]) scale([4.2 + g, 3.4 + g, 2.2 + g]) sphere(1, $fn = 28);
    translate([0, 1, 10.8]) scale([5 + g, 4.2 + g, 3.4 + g]) sphere(1, $fn = 28);
  }
  translate([0, -1, 24.8]) scale([2.8 + g, 2.6 + g, 2.8 + g]) sphere(1, $fn = 24);   // neck
}
// 2D stroke (x, z) for painted lines.
module seg2(a, b, w) { hull() { translate(a) circle(w, $fn = 8); translate(b) circle(w, $fn = 8); } }
module strokes(ls, w) { for (l = ls) for (i = [0 : len(l) - 2]) seg2(l[i], l[i + 1], w); }
// An (x, z) shape stood up and pushed through the front (y < y0) or the back (y > y0).
module front(y0 = -0.8) { translate([0, y0, 0]) rotate([90, 0, 0]) linear_extrude(height = 30) children(); }
module back(y0 = 0.8) { translate([0, y0, 0]) rotate([-90, 0, 0]) mirror([0, 1, 0]) linear_extrude(height = 30) children(); }

// The torso and everything on it stands DZ up on the long legs.
DZ = 3;
translate([0, 0, DZ]) {
color(fur) torso();
// Cream throat, chest, abs and lower belly down to the crotch.
color(cream) intersection() {
  torso(0.25);
  front() polygon([[-3, 27.5], [3, 27.5], [3.6, 24], [4.4, 21], [3.2, 16.5], [3.4, 13], [2.8, 9.6], [1.6, 7.4],
    [-1.6, 7.4], [-2.8, 9.6], [-3.4, 13], [-3.2, 16.5], [-4.4, 21], [-3.6, 24]]);
}
// Pec line and abs, drawn faint.
color(creamDk) intersection() {
  torso(0.42);
  front() strokes([[[0, 15.4], [0, 21.4]], [[-2.4, 17], [2.4, 17]], [[-2.6, 19.1], [2.6, 19.1]],
    [[-4, 22.2], [-2, 21.5], [0, 21.2], [2, 21.5], [4, 22.2]]], 0.17);
}
// Back: spine groove, shoulder blades and lats.
color(furDp) intersection() {
  torso(0.3);
  back() strokes([[[0, 15], [0, 24]], [[1, 23.4], [3.2, 22], [3.6, 19.6], [2, 18.2]], [[-1, 23.4], [-3.2, 22], [-3.6, 19.6], [-2, 18.2]],
    [[4.8, 20.6], [3.4, 15.6]], [[-4.8, 20.6], [-3.4, 15.6]]], 0.16);
}
// Deltoids.
ell([2.7, 2.6, 2.5], [5.9, 0.4, 23.6], fur);
ell([2.7, 2.6, 2.5], [-6, 0.6, 23.2], fur);

// ---- Gold championship belt with plates on the back and a round buckle in front.
color(gold) intersection() { torso(0.55); translate([-20, -20, 13]) cube([40, 40, 2.5]); }
color(goldDk) intersection() {
  torso(0.66);
  union() {
    translate([-20, -20, 12.95]) cube([40, 40, 0.3]);
    translate([-20, -20, 15.25]) cube([40, 40, 0.3]);
    back() for (x = [-3.6, -1.3, 1.3, 3.6]) translate([x - 0.14, 12.9]) square([0.28, 2.7]);
  }
}
translate([-0.8, -3.4, 14.2]) rotate([94, 0, 0]) {
  color(goldDk) cylinder(h = 0.9, r = 2.4, $fn = 28);
  color(gold) cylinder(h = 1.2, r = 2.05, $fn = 28);
  color(goldHi) cylinder(h = 1.45, r = 1.25, $fn = 22);
}
}

// ---- Head, turned a little further from the viewer than the body and tipped down: a glare over the guard.
HEAD = [-0.9, -3, 33.2];   // DZ plus a longer neck
HEAD_R = [6, 0, -12];
// Brow ridge over an eye at p (size s, same yaw); the inner end drops `drop` (share of s) towards the snout.
module brow(p, s, drop, c, yaw = 0) {
  color(c) translate(p) rotate([0, 0, yaw]) hull() {
    translate([s * 1.0, s * 0.1, s * 0.85]) scale([s * 0.5, s * 0.6, s * 0.38]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([-s * 0.85, -s * 0.12, s * (0.75 - drop)]) scale([s * 0.5, s * 0.6, s * 0.36]) rotate([0, 90, 0]) sphere(1, $fn = 12);
    translate([s * 0.1, s * 0.25, s * 1.0]) scale([s * 1.05, s * 0.7, s * 0.45]) rotate([0, 90, 0]) sphere(1, $fn = 12);
  }
}
module snout(g = 0) {
  hull() {
    translate([0, -3, -1.4]) scale([2.7 + g, 3 + g, 2.3 + g]) sphere(1, $fn = 24);
    translate([0, -6.6, -1.8]) scale([1.45 + g, 1.5 + g, 1.25 + g]) sphere(1, $fn = 18);
  }
  hull() {
    translate([0, -1.6, -2.5]) scale([2.9 + g, 2.6 + g, 1.9 + g]) sphere(1, $fn = 22);
    translate([0, -6.1, -2.5]) scale([1.1 + g, 1.3 + g, 0.85 + g]) sphere(1, $fn = 16);
  }
}
translate(HEAD) rotate(HEAD_R) {
  ell([4.2, 4.6, 4.5], [0, 0.6, 0.6], fur);
  color(fur) intersection() { snout(); translate([-10, -10, -2.2]) cube(20); }
  color(cream) intersection() { snout(); translate([-10, -10, -12.2]) cube([20, 20, 10]); }
  ell([0.65, 0.45, 0.5], [0, -8.1, -1.45], furDp);
  // The smirk: the mouth line runs back along the jaw and curls up at the corner.
  color(ink) intersection() {
    snout(0.12);
    rotate([90, 0, 90]) linear_extrude(height = 20, center = true)
      strokes([[[-8.4, -2.4], [-6.6, -2.6], [-4.6, -2.65], [-2.9, -2.35], [-2.0, -1.65]]], 0.15);
  }
  mirror_x() {
    eye([2.95, -2.7, 0.1], 1.75, iris = iris, pupil = [0.06, 0.04, 0.03], yaw = 16, flat = 0.45, shine = true,
        lid = 0.3, lid_tilt = 24, lid_c = furDk);
    brow([2.95, -2.7, 0.1], 1.75, 0.55, furDk, 16);
    // Cheek ruff: two blunt lobes at the back of the jaw.
    petal([0.6, 1.4, 0.85], [3.3, 1.0, -2.6], [0, 0, -20], fur);
    petal([0.55, 1.2, 0.75], [3.65, 1.4, -1.2], [0, 0, -30], fur);
    // Long ears splayed in a V, the cream inside turned forwards.
    translate([2.1, 1.0, 3.7]) rotate([0, 30, 0]) rotate([-8, 0, 0]) rotate([0, 0, 22]) {
      petal([1.95, 0.85, 3.9], [0, 0, 3.6], [0, 0, 0], fur);
      petal([1.15, 0.45, 3.1], [0, -0.5, 3.9], [0, 0, 0], earIn);
    }
  }
}

// ---- Arms: muscled, red tape wraps from mid forearm over the fist.
// (the shoulders and elbows ride DZ up with the torso; the fists stay a little lower, under the raised head)
SL = [6, 0.4, 26.5];  EL = [8.8, -1.5, 19.6];  WL = [7.6, -5, 21.3];  FL = [6.4, -7.4, 24.2];
SR = [-6.2, 0.6, 26];  ER = [-10.2, -2, 18.6];  WR = [-9.3, -4.6, 20.6];  FR = [-9.2, -6, 23.9];
module wrapHull(F, W, g = 0) {
  hull() { translate(F) scale([2.5 + g, 2.3 + g, 2.6 + g]) sphere(1, $fn = 22); translate(W) sphere(2 + g, $fn = 16); }
}
module arm(S, E, W, F) {
  limb(S, E, 2.3, 1.8, fur);
  ell([2.1, 2.1, 2.3], S + (E - S) * 0.4, fur);   // biceps
  limb(E, W, 1.75, 1.55, fur);
  color(red) wrapHull(F, W);
  // Tape lines round the wrist and across the knuckles.
  color(redDk) intersection() {
    wrapHull(F, W, 0.14);
    union() {
      for (t = [0.1, 0.42]) translate(W + (F - W) * t) rotate(_dir_rot(F - W)) rotate([14, 0, 0]) cube([12, 12, 0.32], center = true);
      // the folded fingers: a crease across the front of the fist
      translate(F) rotate(_dir_rot(F - W)) intersection() { translate([-6, -6, 0.4]) cube(12); rotate([90, 0, 0]) cube([12, 0.3, 12], center = true); }
    }
  }
}
arm(SL, EL, WL, FL);
arm(SR, ER, WR, FR);

// ---- Legs: an upright stance, slightly bent, knees under the hips; big haunches, shins back to the heel, long flat
// feet with three cream claws, the rear (right) foot a little back and out.
HL = [4.4, 1.2, 14.6];  KL = [6.6, -2, 8.2];  BL = [5.8, 1.8, 1.3];  TL = [7.6, -5.4, 1.0];
HR = [-4.4, 1.2, 14.6];  KR = [-7.6, -1.2, 8];  BR = [-7.8, 3.4, 1.3];  TR = [-9.8, -3.6, 1.0];
module leg(H, K, B, T) {
  limb(H, K, 3.6, 2.5, fur);
  ell([3.5, 3.5, 3.7], H + (K - H) * 0.4, fur);   // haunch
  limb(K, B, 2, 1.4, fur);
  v = (T - B) / norm(T - B);
  n = [-v[1], v[0], 0];
  color(fur) hull() {
    translate(B) sphere(1.3, $fn = 16);
    translate(T) rotate([0, 0, atan2(v[1], v[0])]) scale([1.8, 2.1, 1.0]) sphere(1, $fn = 20);
  }
  for (k = [-1, 0, 1]) spike(T + v * 1.2 + n * 1.05 * k + [0, 0, -0.1], (v + n * 0.3 * k) * 1.5 + [0, 0, -0.3], 0.75, 0.2, claw);
}
leg(HL, KL, BL, TL);
leg(HR, KR, BR, TR);

// ---- Thick tail out behind the near leg, bound in white bandages, the fur tip curling up.
T = [[0, 4, 13.3], [3.5, 6.5, 12], [5.5, 9.8, 11.2], [8, 10.8, 12.2], [8.6, 10.2, 15.6], [7.9, 9.2, 19.4]];
TRAD = [3.4, 3.0, 2.7, 2.4, 1.6, 0.5];
chain([T[0], T[1]], [TRAD[0], TRAD[1]], fur);
chain([T[3], T[4], T[5]], [TRAD[3], TRAD[4], TRAD[5]], fur);
module bandaged(g = 0) { for (i = [1 : 2]) hull() { translate(T[i]) sphere(TRAD[i] * 1.06 + g, $fn = 22); translate(T[i + 1]) sphere(TRAD[i + 1] * 1.06 + g, $fn = 22); } }
color(bandage) bandaged();
// Wrap lines, slanted like a spiral binding.
color(bandageDk) intersection() {
  bandaged(0.12);
  union() for (s = [[1, 0.2], [1, 0.62], [2, 0.05], [2, 0.45], [2, 0.85]])
    let(a = T[s[0]], b = T[s[0] + 1]) translate(a + (b - a) * s[1]) rotate(_dir_rot(b - a)) rotate([18, 0, 0]) cube([14, 14, 0.3], center = true);
}
