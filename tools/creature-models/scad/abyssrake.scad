// Abyssrake: Tidalfang sunk into the deep as an abyssal sea serpent: a thick navy body rearing up from two upright
// coils, dotted with glowing cyan spots, a slate banded belly, a horned dragon head with gaping red jaws full of cream
// fangs, one fierce green eye a side, cyan cheek frills, and a great cyan-veined fin fanning down the back of the neck.
//
// Checklist (front sheet, 35.7 x 40 units; sheet x, z). The art stands in a pile of rocks (z 0..5) with rock chips
// flying round it: neither is modelled. The coils' undersides sit at sheet z 4: everything is built at sheet height
// and dropped G = 4 so they rest on the ground (compare with --ground 4).
//   body plan  the art is a frontal composition, so the body is authored in the picture plane (pp coordinates:
//              x = sheet x, y = depth behind the picture, z = sheet z) and turned VIEW in the scad
//   neck       a thick column (r 4..4.8) from the back of the head arching over at z 33 (x 0) and dropping to the
//              ground at x -2.5; its slate belly faces the head side (sheet left, x -8..-1), the navy dorsal side with
//              two rows of glowing spots faces right (x 0..3)
//   right coil an upright ring in front, centre (8.5, 11.8), outer x 0..17.8, z 4..19.6, a hole at (5.5..10, 9.5..14)
//   left coil  a ring behind the neck, centre (-11.5, 10.6), outer x -17.8..-7, z 4..17.3, a hole (-13..-9.5, 8..12.5);
//              the tail tip tucks away behind the neck
//   coils      navy with cyan spots in rows on both faces, slate belly on the inside of each loop, little teal ridge
//              fins on the outer top (left coil x -14.5..-10.5 z 17, right coil x 12..14.5 z 19)
//   head       a long dragon head in profile facing sheet-left: skull top z 36 at x -6, snout tip (-13.9, 31), jaw line
//              z 29.8; the lower jaw dropped ~50 deg to a tip at (-10.5, 23); red mouth and pink tongue inside, cream
//              fangs down from the upper jaw (big at -13.3 and -10.8) and up from the lower one
//   eye        one almond green eye a side at (-8.2, 31.3), 1.5 wide, slanted up to the back, hooded by a dark brow
//   horns      two swept-back horns per side on the skull (tips (-6.8, 38.1), (-3.4, 38))
//   frill      bright cyan spiky cheek frills behind the jaw hinge (x -3.3..0, z 27..34)
//   fin        the big dorsal fan from the skull top (-2, 39.8) down the back of the neck to (4.6, 18), spiky rim
//              (6.2, 39.5), (9.8, 35), (11.3, 29), (9.5, 23.4), (7.3, 20.5), teal membrane with glowing branching veins
//   back       the same fin and spots seen from behind, the slate belly on the far side of the neck column
include <lib.scad>

G = 4;  // the coils' undersides on the sheet

navy = [0.12, 0.23, 0.4];
navyHi = [0.17, 0.33, 0.52];
slate = [0.4, 0.5, 0.58];
slateLine = [0.2, 0.27, 0.36];
glow = [0.21, 0.95, 0.97, GLOW];
finCol = [0.1, 0.44, 0.6];
frillCol = [0.15, 0.74, 0.84, NOGLOW];
ridgeCol = [0.1, 0.45, 0.6];
mouth = [0.55, 0.16, 0.21];
throat = [0.3, 0.06, 0.1];
tongue = [0.82, 0.34, 0.36];
fang = [0.97, 0.88, 0.6];
eyeGreen = [0.35, 0.9, 0.15, NOGLOW];
eyeLime = [0.72, 1, 0.38, NOGLOW];
ink = [0.03, 0.05, 0.1];

// Catmull-Rom spline through control points P, n samples per span: the smooth body path.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerp_r(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);
function unit(v) = v / norm(v);

// The body path in pp coordinates, head end first: the neck arches over and drops to the ground (0..5), bends into
// the right coil in front (6..12), passes behind the neck (13..14) and makes the left coil (15..19), the tail tip
// tucking away behind the neck (20, 21).
CTRL = [[-3, -0.5, 31.5], [0.3, 1.2, 31.8], [1.3, 1, 28.5], [-0.4, 0.5, 22], [-2, 0, 15.5], [-2.8, -0.5, 10],
        [1, -1.5, 6.9], [6.5, -2, 6.6], [12, -1.8, 7.1], [15, -1.4, 11.5], [12.7, -1, 16.2], [7.5, -0.5, 16.2],
        [2.8, 1, 13.2], [2, 3.5, 8.3], [-3, 5, 6.2], [-9, 3.5, 5.9], [-13.6, 2.8, 6.3], [-15.7, 2.4, 10.6],
        [-13.4, 2.2, 14.3], [-9.6, 2.6, 14.4], [-6, 4, 13], [-3.5, 5, 12]];
CTRL_R = [3, 3.4, 3.8, 4.4, 4.6, 4.8, 3.2, 2.9, 3, 3.2, 3.2, 3.3, 3, 2.6, 2.3, 2.2, 2.2, 2.4, 2.9, 2.4, 1.6, 0.6];
S = 3;
PTS = spline(CTRL, S);
RS = lerp_r(CTRL_R, S);
NP = len(PTS);
CR = [8.5, -1.2, 11.8];   // right coil centre
CL = [-11.5, 2.8, 10.6];  // left coil centre
D = [0, 1, 0];            // the depth axis: the coils' faces look along it
function seg(i) = floor(i / S);
function tang(i) = unit(PTS[min(i + 1, NP - 1)] - PTS[max(i - 1, 0)]);
function side(i) = unit(cross(tang(i), D));   // in-plane normal: the neck's dorsal side
function inPlane(v) = unit([v[0], 0, v[2]]);
// the belly side: the neck's ventral side faces sheet-left, each coil's faces its own centre
function belly(i) = seg(i) <= 5 ? -side(i) : inPlane((seg(i) <= 12 ? CR : CL) - PTS[i]);

// slate belly: a strip down the ventral side, the neck's broad, the coils' on the inside of the loop, banded by
// darker scale lines
module bellyRun(i0, i1, a, k) {
  chain([for (i = [i0 : i1]) PTS[i] + belly(i) * RS[i] * a], [for (i = [i0 : i1]) RS[i] * k], slate, $fn = 12);
  for (i = [i0 + 1 : i1 - 1]) color(slateLine) translate(PTS[i] + belly(i) * RS[i] * a)
    rotate(_dir_rot(tang(i))) scale([RS[i] * (k + 0.03), RS[i] * (k + 0.03), 0.22]) sphere(1, $fn = 12);
}
// the dorsal fin's spike tips (bottom to top), the notches between them and the vein roots on the neck
FTIP = [[4.6, 18], [7.6, 20.4], [9.8, 23.2], [11.6, 29.2], [10, 35], [6.4, 39.6], [1.6, 39.6], [-1.4, 40]];
FNOTCH = [[5, 20.2], [7.2, 22.6], [8.4, 25.4], [8.8, 31.2], [7.6, 35.8], [3.8, 37.8], [0.2, 38.4]];
FROOT = [[1.8, 20.2], [1.6, 22.2], [1.2, 24.5], [0.5, 28], [-0.6, 31.5], [-1.6, 34.5], [-2.2, 36.5], [-2.6, 37.5]];

translate([0, 0, -G]) pp(0) {
  // ---- body
  chain(PTS, RS, navy, $fn = 14);

  bellyRun(1, 5 * S, 0.15, 0.95);
  bellyRun(6 * S, 12 * S + 1, 0.25, 0.85);
  bellyRun(15 * S, 19 * S, 0.25, 0.85);

  // glowing cyan spots: two rows down the neck's dorsal flanks, two rows on each face of the coils
  for (i = [2 : NP - 5]) for (s = [-1, 1]) for (h = [-1, 0, 1]) if ((i + h) % 2 == 0 && (h != 0 || seg(i) > 5)) {
    n = seg(i) <= 5 ? unit(side(i) * (h > 0 ? 0.95 : 0.3) + D * s * 0.85) : unit(D * s + side(i) * h * 0.62);
    color(glow) translate(PTS[i] + n * RS[i] * 0.98) rotate(_dir_rot(n)) scale([0.62, 0.5, 0.2]) sphere(1, $fn = 6);
  }

  // little teal ridge fins on the coils' outer tops: [x, z, lean, size]
  for (f = [[-14.6, 16.6, -40, 1], [-12.4, 17.1, -10, 1.2], [-10.4, 16.9, 15, 0.9], [-16.9, 13.2, -60, 0.8],
            [12.1, 18.9, 10, 1], [14, 18.2, 35, 1.3], [16.2, 15.6, 55, 0.9]])
    translate([f[0] - 0.8 * sin(f[2]), f[0] < 0 ? 2.5 : -1.2, f[1] - 0.8 * cos(f[2])]) rotate([0, f[2], 0]) scale(f[3])
      plate([[-0.9, -1], [-0.4, 0.6], [0.2, 2], [0.9, -1]], 0.7, 0.15, ridgeCol, grow = 0.1);

  // ---- the great dorsal fin: a teal fan off the back of the neck (a plate 1.6 thick, so it reads from the side too),
  // its spiky rim traced off the sheet and its branching veins glowing through both faces
  FIN = concat([[1.8, 19.6]], [for (k = [0 : len(FTIP) - 1]) each (k < len(FNOTCH) ? [FTIP[k], FNOTCH[k]] : [FTIP[k]])],
               [[-2.8, 38.6], [-2.8, 36.2], [-1.6, 33.5], [0.4, 28], [1.6, 23]]);
  translate([0, 0.9, 0]) {
    plate(FIN, 1.6, 0.3, finCol, grow = 0.3);
    color(glow) intersection() {
      plate(FIN, 1.9, 0.3, grow = 0.3);
      rotate([90, 0, 0]) linear_extrude(height = 10, center = true) for (k = [0 : len(FTIP) - 1]) {
        R = FROOT[k]; T = FTIP[k]; P = R + (T - R) * 0.5;
        hull() { translate(R) circle(0.34, $fn = 8); translate(T) circle(0.2, $fn = 8); }
        if (k < len(FNOTCH)) hull() { translate(P) circle(0.26, $fn = 8); translate(P + (FNOTCH[k] - P) * 0.72) circle(0.18, $fn = 8); }
        if (k > 0) hull() { translate(P + (T - P) * 0.4) circle(0.22, $fn = 8); translate(P + (FNOTCH[k - 1] - P) * 0.75) circle(0.16, $fn = 8); }
      }
    }
  }
}

// the throat: the back of the lower jaw filling down into the neck
translate([0, 0, -G]) pp(0) color(navy) hull() {
  translate([-5.2, -1.2, 28.6]) sphere(2, $fn = 14);
  translate([-6.4, -1.4, 25.6]) sphere(1.5, $fn = 12);
  translate([-3, -0.6, 22.6]) sphere(2.6, $fn = 14);
}

// ---- head: a long dragon head in its own frame (snout along -Y, its near side +X, cranium at the origin), turned
// HYAW in the picture plane so the snout points sheet-left and a little towards the viewer
HP = [-5.5, -1.5, 33.3];
HYAW = -70;
JAWA = 50;   // the lower jaw's drop
module head() {
  // skull: cranium hulled into a long snout with a flat palate
  color(navy) hull() {
    translate([0, 0.8, 0.4]) scale([3, 3.2, 3]) sphere(1, $fn = 22);
    translate([0, -4.2, -0.6]) scale([2.2, 2.6, 2.3]) sphere(1, $fn = 18);
    translate([0, -8, -1.9]) scale([1.4, 1.2, 1.45]) sphere(1, $fn = 14);
    translate([0, -4.5, -2.9]) scale([2, 3.6, 0.5]) sphere(1, $fn = 14);
  }
  // lighter blue snout ridge
  color(navyHi) hull() {
    translate([0, -1.5, 2.3]) scale([1.4, 1.4, 0.6]) sphere(1, $fn = 12);
    translate([0, -7.6, -1.1]) scale([0.7, 0.8, 0.3]) sphere(1, $fn = 10);
  }
  for (m = [0, 1]) mirror([m, 0, 0]) {
    // nostril
    color(ink) translate([0.75, -8.3, -1.4]) scale([0.3, 0.4, 0.22]) sphere(1, $fn = 8);
    // hard brow ridge over the eye, sloping down to the snout: the scowl
    color(navy) hull() {
      translate([1.8, -5.1, -1.2]) scale([0.4, 0.5, 0.25]) sphere(1, $fn = 10);
      translate([2.3, -2.2, -0.3]) scale([0.45, 0.6, 0.32]) sphere(1, $fn = 10);
    }
    // the eye: a green almond, hooded and slanted
    eye([1.95, -3.6, -2], 1, iris = eyeLime, sclera = eyeGreen, pupil = eyeLime, yaw = 68, lid = 0.36, lid_tilt = 24,
        lid_c = ink, squint = 0.28, shine = false);
    // two swept-back horns
    color(navyHi) {
      hull() { translate([1.1, -1.5, 1.9]) sphere(0.6, $fn = 10); translate([1.5, -0.7, 4.9]) sphere(0.08, $fn = 6); }
      hull() { translate([1.1, 0.9, 2.3]) sphere(0.7, $fn = 10); translate([1.5, 2.6, 5.2]) sphere(0.08, $fn = 6); }
    }
    // cyan cheek frill fanning back behind the jaw hinge, three spiky lobes
    translate([2.5, 1.4, -1.6]) rotate([0, 0, -30]) rotate([0, 0, 90])
      plate([[-0.6, 1], [2.4, 3.6], [6, 3.4], [3.8, 1.4], [6.6, 0], [4, -1.2], [5.6, -3.6], [2.4, -2.8], [-0.4, -1.8]],
            0.8, 0.2, frillCol, grow = 0.2);
    // upper fangs: big ones near the tip and mid jaw, small ones between
    for (t = [[-8.3, 0.85, 1.7, 0.42], [-7.2, 1.05, 0.8, 0.3], [-6.1, 1.3, 1.5, 0.4], [-5, 1.45, 0.9, 0.3],
              [-3.9, 1.55, 1.1, 0.34], [-2.8, 1.6, 0.8, 0.3]])
      spike([t[1], t[0], -3], [0, 0, -t[2]], t[3], 0.04, fang);
  }
  // the gaping mouth: red inside, a dark throat at the back
  color(mouth) hull() {
    translate([0, 0.2, -2.7]) scale([1.6, 1, 1]) sphere(1, $fn = 12);
    translate([0, -7.6, -3]) scale([0.8, 0.4, 0.3]) sphere(1, $fn = 8);
    translate([0, 0.2, -3]) rotate([JAWA, 0, 0]) translate([0, -7.6, 0.5]) scale([0.8, 0.4, 0.3]) sphere(1, $fn = 8);
  }
  color(throat) translate([0, 0.4, -3.3]) scale([1.3, 0.8, 1.1]) sphere(1, $fn = 12);
  // lower jaw, dropped open, with its tongue and teeth
  translate([0, 0.2, -3]) rotate([JAWA, 0, 0]) {
    color(navy) hull() {
      scale([2, 1.6, 1]) sphere(1, $fn = 16);
      translate([0, -8.2, 0]) scale([1, 0.9, 0.75]) sphere(1, $fn = 12);
    }
    color(tongue) translate([0, -4, 0.65]) scale([0.8, 3.2, 0.35]) sphere(1, $fn = 12);
    for (m = [0, 1]) mirror([m, 0, 0]) for (t = [[-7.9, 0.75, 1.3, 0.38], [-6.6, 0.95, 0.8, 0.28], [-5.3, 1.1, 1.1, 0.34], [-4, 1.25, 0.7, 0.28]])
      spike([t[1], t[0], 0.4], [0, 0, t[2]], t[3], 0.04, fang);
  }
}
translate([0, 0, -G]) pp(0) translate(HP) rotate([0, 0, HYAW]) head();
