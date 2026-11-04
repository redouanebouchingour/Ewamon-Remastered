// Ironcarab: a steel rhinoceros beetle drawn side-on, head to the viewer's left.
// Checklist (front sheet, height 40, feet on z 0):
//  - shell: a big domed steel carapace, sheet x -10..24.5, z 16..38.5, highest at the front (z 38.5 at x 2..9),
//    falling to the rear (24.5, 22). Two pieces: the pronotum (x -10..7, z 21..36.5), a lighter steel shield with a
//    diagonal row of rivets, then a groove edged in bronze (from (3, 37.5) down to (8, 22)); the elytra behind it,
//    darker steel, a dark plate seam on the flank (x 15.5, z 25..35), a bronze rim along the bottom (z 20.5..22) and
//    rivets along the seams. The back art: two elytra outlined in bronze, a dark suture down the middle.
//  - horns: a long curved sickle horn from the snout (-9.5, 16.5) up to (-20.7, 38.4), about 3 thick; a shorter one
//    from the head top (-9, 23.5) to (-12.6, 34.6); a thick hooked horn rising off the pronotum (-4.5, 31) to the top
//    (-8, 39.5) with its tip curling forward and down to (-12.4, 38). Dark blue-steel.
//  - head: low under the pronotum lip, x -11..-2, z 13..24, a bronze skull-like cranium over a dark face. ONE small
//    orange eye with a yellow core at (-5.5, 18.7) in a dark socket; the far eye is its mirror (hidden).
//    Pale grey fangs hang below the face (x -9..-5, z 9..15).
//  - legs: six thick jointed legs, bronze-brown segments with dark joints and dark hooked feet with claws. Near front
//    leg tucked under the head (0, 7); near middle leg straight down to (5.5, 1); near rear leg (16, 1); the far
//    front leg reaches out past the head to the claws at (-24.7..-17, 3..5) (its top hidden behind the head), the far
//    middle (14, 3) and the far rear leg reaching back to (23.5, 6).
//  - underbody: dark segmented belly under the rim (z 12..21).
//  - pose: side-on, so the whole body is yawed 25 degrees to its right (YAW) on top of the 30 degree view.
include <lib.scad>

steel = [0.31, 0.37, 0.43];
steelHi = [0.4, 0.47, 0.53];
hornC = [0.33, 0.39, 0.45];
bronze = [0.5, 0.42, 0.32];
bronzeDark = [0.36, 0.3, 0.24];
under = [0.2, 0.18, 0.17];
legC = [0.42, 0.32, 0.25];
seamC = [0.15, 0.16, 0.19];
rivetC = [0.62, 0.68, 0.72];
fangC = [0.62, 0.6, 0.54];
eyeC = [0.97, 0.55, 0.12, NOGLOW];
eyeCore = [1, 0.86, 0.38, GLOW];

// The body is authored in its own frame (bx across, by along, the head towards -by) and turned YAW to its right.
// Fb(sheet x, sheet z, bx) is the body-frame point that lands on that spot of the front sheet at the side offset bx
// (the camera sees the body frame from VIEW + YAW and looks 10 degrees down: deeper points read 0.17 / unit higher).
YAW = 25;
A = VIEW + YAW;
function Fb(sx, sz, bx) = let(by = (sx - cos(A) * bx) / sin(A), d = -sin(A) * bx + cos(A) * by) [bx, by, sz - 0.17 * d];
// The same without the height correction: feet stand on z = 0.
function Fz(sx, z, bx) = [bx, (sx - cos(A) * bx) / sin(A), z];
// A point on an ellipsoid's surface: azimuth from -by towards +bx, elevation up.
function onEll(c, r, az, el) = c + [r[0] * cos(el) * sin(az), -r[1] * cos(el) * cos(az), r[2] * sin(el)];

// Elytra: two ellipsoids hulled (high front, lower rear), cut flat at the rim.
E1 = [[12, 9, 17.6], Fb(7.2, 21, 0)];
E2 = [[11, 9.6, 13.6], Fb(15.4, 20.5, 0)];
RIM = 19.6;
PRO = [[10, 8.6, 10.2], Fb(-1.4, 26.8, 0)];
BELLY = [[9, 15, 5.5], Fb(9, 15.5, 0)];
HEAD = [[6, 6.2, 6], Fb(-7.2, 18.6, 0)];
JAW = [[4.2, 4.6, 3.6], Fb(-7.8, 14, 0)];
// The eye on the head's near flank, facing the viewer and a little forward.
EYE_N = [0.932, -0.362];
EYE = HEAD[1] + [HEAD[0][0] * EYE_N[0] * 0.93, HEAD[0][1] * EYE_N[1] * 0.93, 0.3];
EYE_YAW = 69;
// Horns (central): the long snout sickle, the short head horn, the hooked pronotum horn.
HORN_L = [Fb(-9.4, 15.8, 0), Fb(-13.5, 19.4, 0), Fb(-17, 23.6, 0), Fb(-19.2, 28.5, 0), Fb(-20.3, 33.5, 0), Fb(-20.8, 38.4, 0)];
HORN_LR = [2.3, 2.2, 2.0, 1.75, 1.25, 0.2];
HORN_S = [Fb(-8.6, 22.5, 0), Fb(-10.6, 27.5, 0), Fb(-12, 31.5, 0), Fb(-12.6, 34.8, 0)];
HORN_SR = [1.6, 1.25, 0.85, 0.15];
HORN_P = [Fb(-4, 30, 0), Fb(-5.6, 34.6, 0), Fb(-7.6, 37.9, 0), Fb(-10.2, 38.9, 0), Fb(-12, 37.9, 0), Fb(-12.6, 36.8, 0)];
HORN_PR = [2.6, 2.2, 1.8, 1.3, 0.7, 0.12];
// Fangs under the face (mirrored): root, bend, tip.
FANG = [Fb(-6, 14, 2.4), Fb(-6.2, 10.8, 2.8), Fb(-7.4, 8.4, 2.2)];
FANG_R = [1, 0.75, 0.12];
FANG2 = [Fb(-9, 13.6, 1.2), Fb(-9.3, 11, 1.4), Fb(-10.2, 9.2, 1)];
FANG2_R = [0.8, 0.6, 0.1];
// Legs [hip, knee, ankle, foot tip, r]: L = near (+bx), R = far; not mirrored (drawn mid-step).
LEGS = [
  [Fb(-3, 14.5, 5), Fb(-3.5, 11, 9), Fz(-1, 5, 10.5), Fz(0.5, 1.4, 11.5), 2.3],        // leg1L near front, under the head
  [Fb(-10, 15, -5), Fb(-13.5, 14, -8), Fz(-18.5, 6, -9.5), Fz(-23, 2.6, -10), 2.4],     // leg1R far front, reaching out
  [Fb(5, 16, 7), Fb(7.5, 11.5, 10), Fz(6, 4, 10.5), Fz(4.5, 1.2, 11), 2.5],             // leg2L near middle
  [Fb(9, 15, -7), Fb(13, 12, -10), Fz(14, 5, -11), Fz(14.5, 1.6, -12), 2.1],            // leg2R far middle
  [Fb(13, 15, 7), Fb(16, 12, 10), Fz(16.5, 5, 10.5), Fz(17, 1.2, 11), 2.3],             // leg3L near rear
  [Fb(17, 16, -7), Fb(21.5, 15, -10), Fz(23, 6, -11), Fz(24.5, 2.6, -12), 2.1],         // leg3R far rear
];

module elyVol(g = 0) hull() {
  translate(E1[1]) scale(E1[0] + [g, g, g]) sphere(1, $fn = 40);
  translate(E2[1]) scale(E2[0] + [g, g, g]) sphere(1, $fn = 36);
}
module elyCut(g = 0) intersection() { elyVol(g); translate([-30, -30, RIM]) cube([60, 70, 40]); }
module proVol(g = 0) translate(PRO[1]) rotate([-12, 0, 0]) scale(PRO[0] + [g, g, g]) sphere(1, $fn = 36);

// A thick jointed leg: bronze femur and tibia, dark knee and ankle, a dark tarsus ending in two hooked claws.
module leg(hip, knee, ankle, tip, r) {
  limb(hip, knee, r * 1.05, r, legC);
  ell([r, r, r] * 1.12, knee, bronzeDark);
  limb(knee, ankle, r * 0.95, r * 0.85, legC);
  ell([r, r, r] * 0.88, ankle, bronzeDark);
  limb(ankle, tip, r * 0.7, r * 0.45, bronzeDark);
  d = tip - ankle;
  side = [-d[1], d[0], 0] / norm([d[0], d[1]]);
  for (s = [-1, 1]) spike(tip, d / norm(d) * 1.1 + side * s * 0.9 + [0, 0, -0.9], r * 0.38, 0.05, bronzeDark);
}

rotate([0, 0, -YAW]) {
  // ---- Underbody: a dark belly with bronze segment ribs.
  ell(BELLY[0], BELLY[1], under);
  for (k = [0 : 2]) color(bronzeDark) intersection() {
    translate(BELLY[1]) scale(BELLY[0] + [0.2, 0.2, 0.2]) sphere(1, $fn = 28);
    translate(BELLY[1] + [0, -3 + 6 * k, 0]) cube([30, 0.8, 30], center = true);
  }

  // ---- Elytra: steel dome, a bronze rim at the bottom, a bronze-edged dark suture down the middle, a dark plate
  // seam across each flank, and a bronze band along the front edge behind the pronotum.
  color(steel) elyCut();
  color(bronze) intersection() { elyVol(0.35); translate([-30, -30, RIM - 0.9]) cube([60, 70, 1.9]); }
  color(bronze) intersection() { elyCut(0.18); translate([-1.1, -30, 0]) cube([2.2, 70, 60]); }
  color(seamC) intersection() { elyCut(0.26); translate([-0.35, -30, 0]) cube([0.7, 70, 60]); }
  color(seamC) intersection() {
    elyCut(0.2);
    translate([0, E2[1][1] - 1.5, 0]) rotate([18, 0, 0]) translate([-30, -0.3, 0]) cube([60, 0.6, 60]);
  }
  // Rivets along the rim, the flank seam and the suture.
  mirror_x() {
    for (az = [70 : 22 : 160]) color(rivetC) translate(onEll(E2[1], E2[0], az, 12) + [0, 0, 0.6]) sphere(0.38, $fn = 8);
    for (el = [22 : 16 : 70]) color(rivetC) translate(onEll(E2[1], E2[0], 100 - el * 0.5, el) + [0.3, 0, 0]) sphere(0.38, $fn = 8);
    for (t = [0.1 : 0.2 : 0.95]) color(rivetC)
      translate(onEll(E1[1] + [0, (E2[1][1] - E1[1][1]) * t, 0], [11, 9, 17 - 4 * t], 9, 80)) sphere(0.38, $fn = 8);
  }

  // ---- Pronotum: a lighter steel shield over the head, a bronze rim at its back edge, a diagonal riveted seam.
  color(bronze) intersection() {
    translate([0, 2.2, -0.4]) proVol(0.35);
    translate([-30, PRO[1][1] + 3.6, -10]) cube([60, 20, 60]);
  }
  color(steelHi) proVol();
  mirror_x() {
    color(seamC) intersection() {
      proVol(0.15);
      translate(PRO[1]) rotate([0, 0, 0]) rotate([0, -40, -30]) translate([-0.3, -30, -30]) cube([0.6, 60, 60]);
    }
    for (k = [0 : 4]) color(rivetC) translate(onEll(PRO[1], PRO[0] + [0.05, 0.05, 0.05], 62 + k * 7, -5 + k * 12)) sphere(0.38, $fn = 8);
  }

  // ---- Horns.
  chain(HORN_L, HORN_LR, hornC);
  chain(HORN_S, HORN_SR, hornC);
  chain(HORN_P, HORN_PR, hornC);

  // ---- Head: a bronze skull-like cranium over a dark face, a small orange eye in a dark socket, pale fangs.
  ell(JAW[0], JAW[1], under);
  ell(HEAD[0], HEAD[1], bronze);
  color(under) intersection() {
    translate(HEAD[1]) scale(HEAD[0] + [0.2, 0.2, 0.2]) sphere(1, $fn = 28);
    translate(HEAD[1] + [0, -9, -1]) rotate([-20, 0, 0]) cube([30, 10, 6], center = true);
  }
  mirror_x() {
    color(under) translate(EYE) rotate([0, 0, EYE_YAW]) translate([0, 0.85, 0.1]) scale([2.3, 0.9, 2.1]) sphere(1, $fn = 20);
    eye(EYE, 1.35, iris = eyeC, sclera = under, pupil = eyeCore, yaw = EYE_YAW, flat = 0.55, shine = false);
    chain(FANG, FANG_R, fangC);
    chain(FANG2, FANG2_R, fangC);
  }

  // ---- Legs.
  for (L = LEGS) leg(L[0], L[1], L[2], L[3], L[4]);
}
