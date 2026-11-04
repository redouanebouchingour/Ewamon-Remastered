// Resilian: a green dragonfly larva diving towards the viewer. Checklist from the sprite (front sheet, 40 units tall):
// - Head (x -13..1, z 2..13): a round green dome; its lower half wrapped in a dark orange band split by ink lines into
//   segments, two big light-orange compound eyes on the band (far one at x -11.5 z 9, near one at x -3.5 z 6.5), each
//   with a white highlight on its outer top; a dark-green muzzle at the front bottom (x -10..-5, z 2..8) with a light
//   green nose bump and a short ink mouth line.
// - Two thin dark antennae from the head top curling up and back over the thorax (to z 21), small orange-red bulb tips.
// - Thorax (x -9..6, z 8..20) green, behind and above the head.
// - Abdomen: a boxy segmented column rising up and back (x 1..10, z 15..31), a red square ring with a green centre on
//   the top of each of four segments; the back art shows pairs of red dots along it.
// - Two thin stalks fork from the abdomen tip to white teardrop buds (x 2.5..7 and 11.5..16, z 32..39.6) with a green
//   midrib.
// - Four long leaf wings (two per side, x -27..27): pale green, a pink-red rim, darker vein lines; the near pair spreads
//   right and a little up, the far pair up-left (the art banks; the model is symmetric between the two).
// - Six dark purple-grey legs hanging under the thorax, curling forward, chunky red claws (z 0..4).
// The back art draws the body flat and horizontal (another pose); the front wins.
include <lib.scad>

// Colours (the evolutions reuse these names).
BODY = [0.56, 0.69, 0.33];
BODY_DK = [0.31, 0.37, 0.18];
WING = [0.76, 0.91, 0.5, NOGLOW];
VEIN = [0.48, 0.6, 0.29];
RIM = [0.8, 0.3, 0.35, NOGLOW];
MARK = [0.7, 0.18, 0.24, NOGLOW];
DOT = [0.86, 0.37, 0.3, NOGLOW];
BAND = [0.72, 0.38, 0.14, NOGLOW];
EYE_OR = [0.96, 0.6, 0.28, NOGLOW];
EYE_IR = [0.84, 0.5, 0.24, NOGLOW];
INK = [0.12, 0.12, 0.1];
LEG = [0.25, 0.24, 0.29];
CLAW = [0.86, 0.24, 0.3, NOGLOW];
TUFT = [0.93, 0.94, 0.93, NOGLOW];
ANT_TIP = [0.88, 0.4, 0.2, NOGLOW];

// ---- Head
H = [0, -12, 7.5];
HR = [7.4, 6.3, 5.7];
ell(HR, H, BODY);

// The orange band: the head's lower half below a plane rising towards the back, above the chin.
module bandRegion() {
  intersection() {
    translate([0, -12, 10.2]) rotate([14, 0, 0]) translate([-20, -20, -40]) cube(40);
    translate([-20, -40, 2.4]) cube([40, 60, 30]);
  }
}
color(BAND) intersection() { translate(H) scale(HR + [0.12, 0.12, 0.12]) sphere(1, $fn = 32); bandRegion(); }
// Ink lines splitting the band into segments.
for (az = [-130, -78, 78, 130]) color(INK) intersection() {
  translate(H) scale(HR + [0.22, 0.22, 0.22]) sphere(1, $fn = 32);
  bandRegion();
  translate(H) rotate([0, 0, az]) translate([-0.17, -20, -10]) cube([0.34, 20, 20]);
}

// Face: two orange compound eyes with a white highlight, the dark muzzle with a nose bump and a mouth line.
EYE_P = [4.6, -16.1, 7.9];
EYE_S = 2.4;
EYE_YAW = 38;
EYE_FLAT = 0.55;
mirror_x() {
  eye(EYE_P, EYE_S, iris = EYE_OR, sclera = EYE_OR, yaw = EYE_YAW, pupil = EYE_OR, shine = false, flat = EYE_FLAT);
  // the big square highlight on the eye's outer top
  color("white") translate(EYE_P) rotate([0, 0, EYE_YAW]) translate([EYE_S * 0.4, -EYE_S * EYE_FLAT * 0.98, EYE_S * 0.42])
    scale([1, 0.5, 1]) sphere(EYE_S * 0.27, $fn = 10);
}
// Muzzle: a flat dark-green plate between the eyes, a light nose bump over a short mouth line.
ell([3, 0.95, 2.7], [0, -17.6, 4.7], BODY_DK);
ell([2.1, 0.8, 1.1], [0, -18.1, 6.6], BODY);
color(INK) translate([0, -18.5, 4.3]) cube([2.4, 0.4, 0.4], center = true);

// Antennae: thin dark curls from the head top, bulb tips.
ANT = [[2, -14.5, 11.8], [4, -15, 16], [4.5, -13, 19.5], [3.5, -10.5, 21]];
ANT_R = [0.3, 0.26, 0.22, 0.2];
mirror_x() {
  chain(ANT, ANT_R, INK);
  color(ANT_TIP) translate(ANT[3]) sphere(0.55, $fn = 10);
}

// ---- Thorax
T = [0, -4.5, 13.5];
TR = [5.8, 6, 5.4];
ell(TR, T, BODY);
ell([5.6, 4, 4.6], [0, -8, 11.2], BODY);  // neck: head and thorax read as one body

// ---- Abdomen: five segments up and back (the first sunk in the thorax), square rings on top, dot pairs underneath.
SEG_A = 42.3;  // the column's rise (degrees from horizontal)
SEG_R = [3.6, 2.6, 3.0];
function seg(i) = [0, -2.3 + 3.3 * i, 12.2 + 3 * i];
SEG_N = [0, -sin(SEG_A), cos(SEG_A)];  // the column's top (dorsal) side
for (i = [0 : 4]) {
  c = seg(i);
  color(BODY) translate(c) rotate([SEG_A, 0, 0]) scale(SEG_R) sphere(1, $fn = 24);
  if (i > 0) {
    color(MARK) translate(c + SEG_N * (SEG_R[2] - 0.05)) rotate([SEG_A, 0, 0])
      difference() { cube([2.3, 2.3, 0.5], center = true); cube([1, 1, 1], center = true); }
    for (sx = [-0.9, 0.9]) color(DOT) translate(c - SEG_N * (SEG_R[2] - 0.15) + [sx, 0, 0]) rotate([SEG_A, 0, 0])
      scale([0.5, 0.5, 0.3]) sphere(1, $fn = 8);
  }
}
// The fork at the tip: a smaller cap segment.
color(BODY) translate(seg(5) + [0, -0.4, -0.5]) rotate([SEG_A, 0, 0]) scale(SEG_R * 0.75) sphere(1, $fn = 20);
// Ink rings between the segments (the art's segment lines), a thin collar at each joint.
for (i = [1 : 4]) color(BODY_DK) translate((seg(i - 1) + seg(i)) / 2) rotate([SEG_A, 0, 0])
  scale([SEG_R[0] * 0.86, 0.35, SEG_R[2] * 0.86]) sphere(1, $fn = 20);

// Stalks and white buds at the abdomen tip.
STALK = [[0.9, 14.6, 28.4], [2.6, 15.6, 30.6], [4.2, 16.4, 32.4]];
STALK_R = [0.6, 0.5, 0.4];
BUD_BASE = [4.5, 16.6, 32.8];
BUD_TOP = [5.7, 17.2, 36.4];
BUD_R = 2.5;
mirror_x() {
  chain(STALK, STALK_R, BODY);
  color(TUFT) hull() {
    translate(BUD_TOP) scale([1, 0.7, 1.05]) sphere(BUD_R, $fn = 20);
    translate(BUD_BASE) sphere(0.5, $fn = 10);
  }
  // green midrib up the bud's front
  chain([[4.6, 16.2, 33.4], [5.2, 15.5, 35.6], [5.7, 15.6, 37.8]], [0.24, 0.24, 0.2], VEIN);
}

// ---- Wings: long leaf blades, rim plate + pale vane proud on both faces + vein lines. wing(root, sweep, dihedral,
// lean, length, width): span along +X, chord up, swept back by `sweep`, tipped up by `dihedral`, leaning back by `lean`.
function wingPts(L, W) = [[0, -0.9], [0, 0.9], [0.3 * L, 0.42 * W], [0.72 * L, 0.55 * W], [L, 0.35 * W],
                          [0.98 * L, -0.05 * W], [0.85 * L, -0.35 * W], [0.4 * L, -0.42 * W]];
module wing(p, sweep, dih, lean, L, W) {
  translate(p) rotate([0, 0, sweep]) rotate([0, -dih, 0]) rotate([-lean, 0, 0]) {
    plate(wingPts(L, W), 0.9, 0.3, RIM, grow = 0.45);
    plate(wingPts(L, W), 1.3, 0.3, WING, grow = -0.75);
    // midrib and two side veins
    color(VEIN) for (v = [[[0.5, 0], [0.97 * L, 0.15 * W]], [[0.35 * L, 0.05 * W], [0.7 * L, 0.42 * W]], [[0.4 * L, 0], [0.8 * L, -0.28 * W]]])
      hull() for (q = v) translate([q[0], 0, q[1]]) rotate([90, 0, 0]) cylinder(h = 1.5, r = 0.2, center = true, $fn = 6);
  }
}
WINGS = [[[3.4, -3.5, 15.5], 6, 14, 25, 27.5, 9.5],    // lower (front) blade
         [[3.2, -1.2, 17.2], 14, 30, 30, 25, 7]];    // upper (hind) blade
mirror_x() for (w = WINGS) wing(w[0], w[1], w[2], w[3], w[4], w[5]);

// ---- Legs: three per side hanging under the thorax, thick hooks curling forward to chunky red claws.
LEG_ROOT = [[3.4, -6.8, 10], [3.6, -4.2, 9.8], [3.6, -1.6, 10.2]];
LEG_KNEE = [[6.4, -7.6, 8.2], [8.2, -4.6, 7.8], [10.6, -1.2, 7.6]];
LEG_BEND = [[7.4, -8.2, 4.6], [9, -5.2, 4.6], [11.2, -2, 4.8]];
LEG_FOOT = [[6.8, -9.6, 2.2], [8.4, -6.4, 2.5], [10.2, -3.4, 2.9]];
function leg(i) = [LEG_ROOT[i], LEG_KNEE[i], LEG_BEND[i], LEG_FOOT[i]];
LEG_R = [1, 0.95, 0.85, 0.75];
CLAW_D = [0, -1.4, -1.9];
mirror_x() for (i = [0 : 2]) {
  chain(leg(i), LEG_R, LEG);
  spike(LEG_FOOT[i], CLAW_D - [0, 0, i * 0.3], 0.85, 0.1, CLAW);
}
