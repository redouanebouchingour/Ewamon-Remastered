// Resilith: Resilian grown into a hunter. Checklist from the sprite (front sheet, 40 units tall; the scad is laid out
// with the body midline at sheet x = 0.5 y - 3.5):
// - Head (sheet x -14..-3.5, z 6..15.5): round, low and in front. A green helmet with a green V down the middle of
//   the forehead (to z 12.8); the face is a brown mask, lighter brown chin, a dark mouth line across under the eyes
//   (z 10.3), big orange cheek / mandible plates on both sides (far x -14..-12.5, near x -6.5..-3.5, z 7..13).
// - Eyes: two small slanted angry red eyes with a white glint (far at x -12.6 z 11.4, near at x -7.1 z 11.2), dark
//   brows slanting down to the middle. Nothing glows.
// - Two thin dark antennae from the forehead curling up and out (far tip x -16 z 22.5, near tip x -3 z 21.5), red tips.
// - Thorax behind the head (x -6..6, z 10..21) green, a ridge of red thorn spikes along its top (z 18..24).
// - Abdomen: a column of four green segments rising up and back from the thorax (x -2.3..4.9, z 18..30), a red square
//   ring with a green centre on the front of each, dark grooves between; a cap at the top (z 29..30).
// - Two dark stalks fork from the abdomen tip into sprigs of pale mint crystal leaves (x -2..2 and 4..9, z 31..40):
//   a top leaf and two side pairs each.
// - Four broad leaf wings (two per side): pale green vane, darker green band along the leading edge, a dark red
//   midrib, a pink-red rim and a pale fringe. Upper pair to (x -20 z 36) and (x 19 z 35), lower pair to (-20, 27) and
//   (20, 24).
// - Legs, per side: a green-armoured foreleg with a long red talon (far x -19..-15, near x 3..7), a raised dark hook
//   leg with a red hook (far x -17 z 13..17), two dark walking legs with red claws (far under the head at x -14 and
//   -11.5, near at x -3.4 and 1.3), a dark hind leg held high with a red claw (near x 7 z 10.5..15).
// The back art shows the abdomen column, the wing roots, the dark legs fanning out and the green forelegs.
include <lib.scad>

// Colours (Resilian's names where they are the same paint).
BODY = [0.56, 0.69, 0.33];
BODY_HI = [0.66, 0.78, 0.4];
BODY_DK = [0.31, 0.37, 0.18];
WING = [0.72, 0.86, 0.47, NOGLOW];
WING_DK = [0.54, 0.64, 0.32];
WING_VEIN = [0.82, 0.94, 0.62, NOGLOW];
FRINGE = [0.66, 0.74, 0.44];
RIM = [0.8, 0.38, 0.4, NOGLOW];
MIDRIB = [0.56, 0.2, 0.22];
MARK = [0.72, 0.2, 0.25, NOGLOW];
THORN = [0.78, 0.25, 0.29, NOGLOW];
CLAW = [0.82, 0.26, 0.3, NOGLOW];
LEG = [0.24, 0.24, 0.28];
MASK = [0.6, 0.41, 0.28];
CHIN = [0.72, 0.53, 0.38];
CHEEK = [0.88, 0.52, 0.2, NOGLOW];
INK = [0.14, 0.1, 0.08];
BROW = [0.2, 0.12, 0.09];
EYE_RED = [0.88, 0.16, 0.2, NOGLOW];
EYE_IR = [1, 0.3, 0.3, NOGLOW];
ANT = [0.22, 0.22, 0.27];
STEM = [0.27, 0.37, 0.2];
LEAF = [0.5, 0.78, 0.55, NOGLOW];
LEAF_HI = [0.84, 0.97, 0.84, NOGLOW];

// ---- Head
H = [0, -10.5, 12.3];
HR = [5.6, 4.6, 4.7];
ell(HR, H, BODY);
// The brown mask: the front of the head.
color(MASK) intersection() {
  ell(HR + [0.2, 0.2, 0.2], H);
  translate([-10, H[1] - 20 - 0.6, H[2] - 10]) cube([20, 20, 20]);
}
// Lighter brown chin under the mouth line.
color(CHIN) intersection() {
  ell(HR + [0.3, 0.3, 0.3], H);
  translate([-2.6, H[1] - 10 - 1.5, H[2] - 10]) cube([5.2, 10, 10 - 1.4]);
}
// The green V of the helmet down the middle of the forehead.
color(BODY) intersection() {
  ell(HR + [0.4, 0.4, 0.4], H);
  translate(H) rotate([90, 0, 0]) linear_extrude(10) polygon([[-2.3, 6], [2.3, 6], [0.45, 0.4], [-0.45, 0.4]]);
}
// Mouth line across the face.
color(INK) intersection() {
  ell(HR + [0.42, 0.42, 0.42], H);
  translate([-1.9, H[1] - 10 - 2, H[2] - 1.35]) cube([3.8, 10, 0.4]);
}
mirror_x() {
  // Orange cheek / mandible plates at the sides of the face.
  color(CHEEK) difference() {
    intersection() {
      ell(HR + [0.6, 0.6, 0.6], H);
      translate(H + [1.8, -10, -4.4]) cube([6, 9.4, 6.0]);
    }
    translate([2.7, -14.6, 12.9]) scale([1.5, 1.4, 1.25]) sphere(1, $fn = 14);
  }
  // Small angry red eyes under dark brows, a white glint.
  eye([2.7, -14.0, 12.9], 1.2, iris = EYE_IR, sclera = EYE_RED, pupil = EYE_IR, shine = true, yaw = 26, flat = 0.8,
      lid = 0.4, lid_tilt = 28, lid_c = MASK, squint = 0.22);
  limb([1.4, -15.1, 13.4], [4.0, -14.3, 14.4], 0.34, 0.28, BROW);  // the dark brow line
  // Antenna: a thin dark curl from the forehead, up and out, a red tip.
  chain([[1.0, -14.5, 14.3], [3.4, -16.2, 17.6], [6.4, -15.2, 21], [7.4, -13, 23]], [0.26, 0.24, 0.22, 0.2], ANT);
  spike([7.4, -13, 23], [0.6, 0.4, 1.2], 0.34, 0.08, THORN);
}

// ---- Thorax with the thorn ridge
ell([4.4, 4.2, 4.0], [0, -6.5, 14.4], BODY);
ell([5.2, 6, 4.6], [0, -0.5, 14.8], BODY);
color(BODY_DK) translate([0, -0.5, 11.2]) scale([4.4, 5.4, 2.2]) sphere(1, $fn = 24);  // the shaded underside
THORNS = [[-8.6, 17.7], [-5, 18.5], [-1.4, 19.2], [2.2, 18.8]];
mirror_x() for (k = THORNS) spike([1.6, k[0], k[1]], [1.1, 0.5, 2.8], 0.75, 0.06, THORN);

// ---- Abdomen: four segments rising up and back, a red square ring on the front of each
SEG_A = -40;
function seg(i) = [0, 6 + 2 * i, 19.2 + 2.3 * i];
SEG_R = [[2.3, 2.1, 1.5], [2.35, 2.15, 1.5], [2.45, 2.2, 1.5], [2.55, 2.3, 1.55]];
color(BODY_DK) translate([0, 4.2, 17.6]) rotate([SEG_A, 0, 0]) scale([2.2, 2, 1.2]) sphere(1, $fn = 20);
for (i = [0 : 3]) {
  translate(seg(i)) rotate([SEG_A, 0, 0]) {
    color(BODY) scale(SEG_R[i]) sphere(1, $fn = 22);
    // dark groove ring above the segment
    color(BODY_DK) translate([0, 0, 1.3]) scale([SEG_R[i][0] * 0.9, SEG_R[i][1] * 0.9, 0.45]) sphere(1, $fn = 18);
    // the red square ring on its front
    color(MARK) translate([0, -SEG_R[i][1] + 0.12, 0.1]) difference() {
      cube([1.85, 0.5, 1.7], center = true);
      cube([0.75, 1, 0.65], center = true);
    }
  }
}
// The cap at the tip.
CAP = [0, 14, 28.4];
color(BODY) translate(CAP) rotate([SEG_A, 0, 0]) scale([2.1, 1.9, 1.3]) sphere(1, $fn = 20);

// ---- Two stalks fork from the tip into crystal-leaf sprigs
module leaf(p, tilt, k = 1) {
  translate(p) rotate([0, 0, 30]) rotate([0, tilt, 0]) {
    color(LEAF) scale([1.05, 0.75, 1.6] * k) sphere(1, $fn = 8);
    color(LEAF_HI) scale([0.6, 0.85, 1.05] * k) sphere(1, $fn = 8);
  }
}
mirror_x() {
  chain([[0.6, 14.3, 29.2], [2.3, 14.8, 30.6], [3.9, 15, 31.8], [4.1, 15, 35.2]], [0.6, 0.5, 0.45, 0.35], STEM);
  leaf([4.1, 15, 36.4], 0, 1.4);
  for (lv = [[33.7, 2.0], [31.1, 2.1]]) for (sx = [-1, 1])
    leaf([4.1, 15, lv[0]] + [sx * lv[1] * 0.866, sx * lv[1] * 0.5, 0.3], sx * 42, 1.3);
}

// ---- Four leaf wings: a pale fringe, the pink-red rim, the pale vane, a darker band along the leading edge, a dark
// red midrib and pale cross veins. Each is a plate: u along the wing, v across it (leading edge v > 0).
UPPER = [[0, -0.9], [0, 0.9], [4, 3], [11, 4.3], [18.5, 4.5], [23.5, 3.6], [25.8, 1.4], [25.6, -1], [22.5, -3.2],
         [16, -4.2], [8.5, -3.6], [3, -2]];
LOWER = [[0, -0.8], [0, 0.8], [4, 2.8], [11, 3.9], [16.5, 3.9], [20.3, 2.7], [21.4, 0.3], [20.3, -2], [15.5, -3.5],
         [8.5, -3.4], [3, -1.8]];
// [root, sweep back, elevation, tilt of the leading edge back, outline, length, scale]
WINGS = [[[3.4, -1.2, 17.8], 29, 33, -15, UPPER, 25.8, 1.08], [[3.4, 0.2, 16.2], 27, 8, -15, LOWER, 21.4, 1.1]];
module wing(w) {
  L = w[5];
  translate(w[0]) rotate([0, 0, w[1]]) rotate([0, -w[2], 0]) rotate([w[3], 0, 0]) scale([w[6], 1, w[6]]) {
    plate(w[4], 0.6, 0.4, FRINGE, grow = 0.75);
    plate(w[4], 0.8, 0.4, RIM, grow = 0.1);
    plate(w[4], 1.0, 0.3, WING, grow = -0.7);
    // darker band along the leading edge
    plate([[1.5, 0.3], [L * 0.3, 2.1], [L * 0.6, 2.7], [L * 0.85, 2.1], [L * 0.93, 0.4]], 1.1, 0.3, WING_DK, grow = 0);
    // midrib and cross veins
    plate([[0.5, 0.15], [L * 0.88, 0.25], [L * 0.88, 0.6], [0.5, 0.55]], 1.25, 0.1, MIDRIB, grow = 0);
    for (f = [0.35, 0.55, 0.75]) plate([[L * f, 0.3], [L * (f + 0.1), -2.4], [L * (f + 0.1) + 0.3, -2.4], [L * f + 0.4, 0.3]], 1.2, 0.05, WING_VEIN, grow = 0);
  }
}
mirror_x() for (w = WINGS) wing(w);

// ---- Legs
mirror_x() {
  // Green-armoured foreleg: a dark upper arm, a green armoured forearm, a long red talon.
  limb([4.3, -5.5, 11.5], [11, -4, 13.5], 1.0, 1.1, LEG);
  color(BODY) hull() {
    translate([11, -4, 13.2]) scale([1.9, 1.9, 1.9]) sphere(1, $fn = 18);
    translate([13.5, -5, 6.6]) scale([1.9, 1.8, 1.9]) sphere(1, $fn = 18);
  }
  color(BODY_HI) translate([12.4, -5.9, 9.8]) rotate([0, 20, 0]) scale([1.1, 1.0, 2.6]) sphere(1, $fn = 14);
  chain([[13.6, -5.2, 6.4], [14.1, -6.0, 3.2], [14.0, -6.8, 0.5]], [1.35, 0.9, 0.14], CLAW);
  // Raised hook leg at the front.
  chain([[3.6, -7.5, 12.4], [7.2, -9.6, 14.8], [10.6, -9, 15]], [1.05, 1.0, 0.9], LEG);
  chain([[10.6, -9, 15], [12.2, -9.6, 13.4], [12.1, -10.4, 11.2]], [0.9, 0.62, 0.14], CLAW);
  // Two walking legs: hip, knee, ankle, red claw.
  chain([[3.8, -5, 10.5], [7.6, -8.5, 10.6], [6.9, -10.4, 4.8]], [1.25, 1.15, 1.0], LEG);
  chain([[6.9, -10.4, 4.8], [6.6, -10.9, 2.3], [6.1, -11.3, 0.2]], [1.02, 0.7, 0.14], CLAW);
  chain([[4, -1.5, 10.5], [9.8, -2, 10.8], [8.8, -3.2, 4.8]], [1.25, 1.15, 1.0], LEG);
  chain([[8.8, -3.2, 4.8], [8.4, -3.5, 2.3], [7.8, -3.8, 0.2]], [1.02, 0.7, 0.14], CLAW);
  // Hind leg held high, the claw hanging.
  chain([[3.8, 2.5, 12.5], [7.6, 4, 16.2], [9.4, 4.5, 14.8]], [1.15, 1.1, 0.95], LEG);
  chain([[9.4, 4.5, 14.8], [9.7, 4.3, 12.8], [9.5, 3.8, 10.6]], [0.95, 0.66, 0.14], CLAW);
}
