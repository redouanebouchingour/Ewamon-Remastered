// Berkest: Fennorange grown into a slim street juggler. A tan fennec on long digitigrade legs with big haunches, a
// wide fox head with cheek tufts, two sly red almond eyes under dark lids, a short cream muzzle with a smirk and one
// little fang, huge leaf ears (orange inside, an olive line and cream tufts along the inner edge), a maroon fez with a
// green star, a green vest open over the cream chest, a checked red / gold / green belt, a plaid scarf with one end
// flying out sideways and the other hanging down its right hip, orange-gloved open hands, three oranges juggled in an
// arc round it, and a big bushy pale tail sweeping out behind its left side and curling up.
//
// Checklist (front sheet x, z; the art's midline sits at sheet x -2.4, so scad x = 0 maps there: OX below; the art's
// feet stand at sheet z 0.9 on a ground shadow, which is not modelled):
// - head: wide fox head x -8.6..3.9, z 21.7..30, cheek tufts out to x -9.6 / 4.6 at z 24.5..26; cream lower face below
//   the eye line (z 25.3), tan muzzle top, dark nose at (-5.8, 24.3), a smirk to (-2.3, 24.1), a fang at (-4, 22.7).
// - eyes: near x -3.3..1, z 25.2..27.4; far x -7.8..-5.6: wide almonds, red iris, black slit pupil, white highlight,
//   heavy dark upper lid falling to the nose (sly), cream brow marks above.
// - ears: far x -12.2..-5.5, tip (-11.8, 39.9); near x 1.3..10.4, tip (9.4, 39.6). Orange inside, olive line and
//   cream tufts on the inner side, tan rim; backs tan (back art).
// - fez: maroon x -5.5..0.6, z 30.3..35.8, darker top, green star outline at (-3.4, 33.2), a dark tassel on its right.
// - scarf: plaid ring z 20..23; near end flying out to (9.4, 21), z 19.9..22.4; far end hanging from the vest's side
//   (-7, 15.5) down to (-12.6..-10, 9.2).
// - vest: green, open over a cream chest square x -5.6..-3, z 15.5..18.8, red and gold edge lines; belt band of red /
//   gold / green checks z 13.4..15.2 all round; below it pointed green flaps (x -8.2..-5.6 and -2..1.4, down to z 9.7)
//   with a cream belly between them. Back: gold check embroidery on the green.
// - arms: slim, out sideways and down to the elbows (z 17.3), forearms out to open palms up at z 16.5; orange gloves
//   (x -13.8..-10.5 and 4.5..7.4), tan fingers curled up.
// - legs: big haunches (far x -8.8..-4.3, near -2.5..3.3, z 6..11), slim shins, long feet; the far foot turned out to
//   (-10, 2), the near one pointing at the viewer (2..5.7).
// - tail: pale tan plume x 1..19, z 4.1..20: a broad lower lobe (x 2..17.6, z 4..14.4) curling up to a tip at (18.6, 18.6).
// - oranges: (-14.1, 29.8) r 1.9, (-13.8, 22) r 1.9, (9.8, 25) r 1.5, leaves on top; motion arcs at x -19..-15.7 and
//   11..14 (the rig hides those in game).
include <lib.scad>

OX = 2.4;   // sheet x of the scad midline is -OX
// Scad point for a point read off the front sheet at depth y (the camera looks 10 deg down: a part further forward
// reads lower on the sheet, so z is lifted 0.17 per unit forward).
function fs(sx, z, y = 0) = fromSheet(sx + OX, z - 0.17 * y, y);

fur = [0.82, 0.69, 0.39];
furDk = [0.66, 0.51, 0.3];
cream = [0.95, 0.84, 0.61];
orangeIn = [0.96, 0.5, 0.08, NOGLOW];
orange = [0.93, 0.47, 0.06, NOGLOW];    // the sheet lists #f17b10 as GLOWS for its brightness; the fruit is not a light
orangeHi = [0.98, 0.62, 0.16, GLOW];    // the fruit's small highlight
glove = [0.9, 0.42, 0.08, NOGLOW];
olive = [0.42, 0.5, 0.22];
leaf = [0.3, 0.5, 0.2, NOGLOW];
maroon = [0.45, 0.1, 0.12];
maroonDk = [0.3, 0.05, 0.07];
star = [0.22, 0.52, 0.27, NOGLOW];
vest = [0.18, 0.4, 0.18];
vestDk = [0.11, 0.24, 0.11];
red = [0.58, 0.16, 0.13];
gold = [0.93, 0.62, 0.22, NOGLOW];
scarfG = [0.2, 0.38, 0.18];
ink = [0.1, 0.04, 0.02];
noseC = [0.22, 0.09, 0.06];
iris = [0.72, 0.12, 0.12, NOGLOW];
swoosh = [0.97, 0.56, 0.14];
swooshG = [0.45, 0.62, 0.26];

// The half-space in front of depth d0 (pp frame): a marking cut with it only shows on the camera-facing surface.
module front(d0 = 0) { pp(0) translate([-60, d0 - 120, -60]) cube(120); }
// A front-sheet outline (sheet x) moved to the scad midline.
function S(pts) = [for (p = pts) [p[0] + OX, p[1]]];
// Lay the children (a body part grown a little) flush on the surface where the camera sees the sheet outline pts.
module mark(pts, d0 = 0) { intersection() { union() children(); prism(S(pts)); front(d0); } }

// ---- Head: a wide skull swelling at the ear bases, cheek ruffs with tufts, a short muzzle
SKULL = [[0, -0.4, 26.4], [5.7, 4.4, 3.8]];
CROWN = [[4.0, 0.6, 28.4], [2.2, 2.2, 1.8]];
JAW = [[0, -2.4, 23.9], [3.4, 3.0, 2.0]];
RUFF = [[4.9, 0.2, 25.0], [2.3, 2.0, 1.9]];
MUZ1 = [[0, -3.8, 25.2], [2.5, 2.3, 2.0]];
MUZ2 = [[0, -6.3, 25.1], [1.25, 1.1, 1.0]];
NOSE = [[0, -7.2, 25.5], [0.75, 0.6, 0.55]];
module skull(g = 0) {
  hull() {
    translate(SKULL[0]) scale(SKULL[1] + [g, g, g]) sphere(1, $fn = 30);
    translate(JAW[0]) scale(JAW[1] + [g, g, g]) sphere(1, $fn = 22);
    for (s = [1, -1]) translate([s * CROWN[0][0], CROWN[0][1], CROWN[0][2]]) scale(CROWN[1] + [g, g, g]) sphere(1, $fn = 18);
  }
}
module muzzle(g = 0) {
  hull() {
    translate(MUZ1[0]) scale(MUZ1[1] + [g, g, g]) sphere(1, $fn = 20);
    translate(MUZ2[0]) scale(MUZ2[1] + [g, g, g]) sphere(1, $fn = 14);
  }
}
module ruffs(g = 0) { mirror_x() translate(RUFF[0]) scale(RUFF[1] + [g, g, g]) sphere(1, $fn = 20); }
color(fur) skull();
color(fur) muzzle();
color(fur) ruffs();
// cheek tufts: two blunt points per side, out and down
mirror_x() {
  spike([6.3, 0.2, 25.7], [1.7, -0.1, -0.2], 0.95, 0.15, fur);
  spike([6.0, 0.0, 24.3], [1.4, -0.2, -1.0], 0.85, 0.15, fur);
}
// the cream lower face: under the eye line, on the camera side
creamPts = [[-11, 25.3], [-7.5, 25.1], [-5.5, 25.0], [-3.5, 25.1], [-1.5, 25.0], [1, 25.2], [3.5, 25.5], [6, 25.5],
            [6, 20], [-11, 20]];
color(cream) mark(creamPts, 2.0) { skull(0.2); muzzle(0.2); ruffs(0.2); }
ell(NOSE[1], NOSE[0], noseC);
// the smirk: a short philtrum, a curve towards the near cheek turning up at the end, a short tick the other way
color(ink) {
  limb([0, -7.05, 24.95], [0, -6.9, 24.35], 0.15);
  limb([0, -6.9, 24.35], [1.2, -6.45, 24.05], 0.15);
  limb([1.2, -6.45, 24.05], [2.3, -5.75, 24.25], 0.15);
  limb([2.3, -5.75, 24.25], [3.0, -5.1, 24.8], 0.15);
  limb([0, -6.9, 24.35], [-0.9, -6.6, 24.15], 0.15);
}
// one little fang under the smirk
color("white") spike([1.1, -6.3, 24.0], [0.05, -0.1, -0.65], 0.24, 0.05);

// eyes: two wide sly almonds, red iris, slit pupil, dark upper lid falling to the nose, a highlight
EYE = [3.1, -3.6, 26.9];
EYE_S = 1.25;
EYE_YAW = 22;
EYE_SQ = [1.4, 1, 0.74];
mirror_x() translate(EYE) scale(EYE_SQ) translate(-EYE)
  eye(EYE, EYE_S, iris = iris, sclera = "white", yaw = EYE_YAW, pupil = ink, flat = 0.5, lid = 0.3, lid_tilt = 16,
      lid_c = ink, squint = 0.08, slit = 0.5, shine = true);
// cream brow marks above the eyes
mirror_x() petal([1.1, 0.32, 0.36], [2.5, -3.2, 28.7], [0, 14, 24], cream);

// ---- Ears: huge leaves on the head's top sides, splayed out in a V, traced from the near ear (x outward from the
// root, z up), mirrored for the far one. Front: orange inside, an olive line and cream tufts on the inner side, a
// tan rim; back: a darker tan panel.
EAR_AT = [6.0, 1.0, 29.4];
EAR_ROT = [-8, 4, 12];
earPts = [[-2.6, 1.7], [-1.8, 4.0], [0.1, 6.0], [2.0, 7.6], [3.6, 8.2], [5.3, 9.9], [6.3, 10.0], [7.4, 8.9], [7.4, 7.0],
          [7.0, 5.2], [6.3, 3.4], [5.5, 1.5], [4.2, 0.7], [2.7, -1.4], [1.0, -2.4], [-1.0, -2.4], [-2.8, -0.6]];
earInPts = [[-1.0, 2.2], [0.4, 5.0], [2.4, 6.8], [4.0, 7.5], [5.6, 9.0], [6.5, 8.5], [6.6, 6.8], [6.1, 4.8], [5.2, 2.6],
            [4.0, 1.4], [2.6, 0.1], [1.0, -0.6], [-0.4, 0.2]];
earLinePts = [[-1.7, 1.4], [-1.2, 1.4], [0.0, 4.0], [1.6, 5.7], [3.4, 6.9], [3.2, 7.3], [1.3, 6.2], [-0.5, 4.5]];
earTuftPts = [[-0.6, 0.6], [1.4, 0.0], [2.8, 1.0], [2.0, 1.6], [3.1, 2.9], [1.8, 2.8], [1.6, 4.0], [0.4, 3.0],
              [-0.4, 2.2]];
earBackPts = [[-1.2, 1.6], [0.4, 5.0], [2.6, 6.8], [5.4, 8.6], [6.5, 7.8], [6.2, 4.6], [5.0, 2.0], [3.0, 0.2], [0.6, -0.8]];
module ear() {
  plate(earPts, 1.1, 0.35, fur, grow = 0.2);
  translate([0, -0.45, 0]) plate(earInPts, 0.3, 0.3, orangeIn, grow = 0);
  translate([0, -0.55, 0]) plate(earTuftPts, 0.3, 0.3, cream, grow = 0);
  translate([0, -0.6, 0]) plate(earLinePts, 0.3, 0.1, olive, grow = 0);
  translate([0, 0.45, 0]) plate(earBackPts, 0.3, 0.4, furDk, grow = 0);
}
mirror_x() translate(EAR_AT) rotate(EAR_ROT) ear();

// ---- Fez: a maroon flat-topped cone worn on the crown, leaning a little to its left, a darker top, a dark tassel cord
// down its near side, the green star outline on the front
FEZ = [0.3, -1.0, 29.6];
FEZ_ROT = [0, 5, 0];
module fez(g = 0) { translate(FEZ) rotate(FEZ_ROT) cylinder(h = 5.8, r1 = 3.05 + g, r2 = 2.75 + g, $fn = 30); }
color(maroon) fez();
color(maroonDk) translate(FEZ) rotate(FEZ_ROT) translate([0, 0, 5.75]) scale([1, 1, 0.18]) sphere(2.72, $fn = 30);
translate(FEZ) rotate(FEZ_ROT) {
  limb([0, 0, 5.95], [2.2, 0.6, 5.7], 0.22, 0.22, ink);
  limb([2.2, 0.6, 5.7], [3.0, 0.4, 3.0], 0.22, 0.34, ink);
}
STAR_C = [-3.4 + OX, 33.2];
STAR_R = 1.35;
function starP(i) = STAR_C + STAR_R * [cos(90 + 72 * i), sin(90 + 72 * i)];
module bar(a, b, w) {
  d = b - a;
  n = [-d[1], d[0]] / norm(d) * w / 2;
  prism([a + n, b + n, b - n, a - n]);
}
color(star) intersection() {
  fez(0.12);
  union() for (i = [0 : 4]) bar(starP(i), starP(i + 2), 0.36);
  front(-2.4);
}

// ---- Neck and the plaid scarf: a ring round the neck, green with red checks
limb([0, 0.2, 20.5], [0, -0.6, 23.5], 2.1, 2.0, fur);
SC = [0, -0.3, 21.7]; SCR = [4.2, 3.6, 1.6];
ell(SCR, SC, scarfG);
module plaid(z0, z1) {
  for (a = [0 : 30 : 330]) rotate([0, 0, a]) translate([-0.3, 0, z0]) cube([0.6, 30, z1 - z0]);
}
color(red) intersection() {
  ell(SCR + [0.06, 0.06, 0.06], SC);
  union() {
    translate(SC) plaid(-3, 3);
    translate(SC + [-6, -6, -0.25]) cube([12, 12, 0.5]);
  }
}
// a scarf end: a strip through the points (broad side facing the viewer), green with red bands across and along it
module strip(pts, w, t) { for (i = [0 : len(pts) - 2]) hull() for (p = [pts[i], pts[i + 1]]) translate(p) scale([w, t, w]) sphere(1, $fn = 14); }
SC_FLY = [[3.4, -1.6, 21.6], [7.4, -1.8, 21.6], [10.8, -1.6, 21.3], [13.4, -1.3, 21.0]];
SC_HANG = [[-3.6, 0.4, 17.6], [-5.0, -0.6, 14.8], [-7.2, -1.1, 12.2], [-9.2, -1.5, 10.0]];
color(scarfG) strip(SC_FLY, 1.25, 0.42);
color(red) intersection() {
  strip(SC_FLY, 1.31, 0.48);
  union() {
    for (x = [5.2, 8.0, 10.8]) translate([x - 0.35, -5, 15]) cube([0.7, 10, 10]);
    translate([0, -5, 21.15]) cube([20, 10, 0.5]);
  }
}
color(scarfG) strip(SC_HANG, 1.45, 0.42);
color(red) intersection() {
  strip(SC_HANG, 1.51, 0.48);
  union() {
    for (z = [11.2, 13.6, 16.0]) translate([-20, -5, z - 0.35]) cube([20, 10, 0.7]);
    hull() for (p = [SC_HANG[1], SC_HANG[2], SC_HANG[3]]) translate(p) scale([0.25, 2, 0.25]) sphere(1, $fn = 6);
  }
}
// fringed tips
for (k = [-1, 0, 1]) limb(SC_FLY[3] + [0.9, 0, 0.75 * k], SC_FLY[3] + [1.9, 0.1, 0.9 * k], 0.28, 0.2, scarfG);
for (k = [-1, 0, 1]) limb(SC_HANG[3] + [0.7 * k - 0.5, 0, -0.8 + 0.5 * k], SC_HANG[3] + [0.7 * k - 1.3, -0.1, -1.8 + 0.5 * k], 0.28, 0.2, scarfG);

// ---- Torso: slim, a green vest open over the cream chest, a checked belt, pointed flaps below it
TORSO = [[[3.5, 3.0, 2.6], [0, 0.3, 13.4]], [[3.9, 3.2, 3.0], [0, 0, 18.4]]];
module torso(g = 0) { blob([for (q = TORSO) [q[0] + [g, g, g], q[1]]]); }
color(fur) torso();
// vest: the torso grown, between the belt and the scarf
color(vest) intersection() { torso(0.3); translate([-10, -10, 15.1]) cube([20, 20, 6.2]); }
// cream chest in the vest's opening, with gold and red edge lines either side
chestPts = [[-5.5, 15.3], [-3.1, 15.3], [-3.1, 19.2], [-4.3, 19.9], [-5.5, 19.2]];
color(cream) mark(chestPts, 0) torso(0.45);
color(gold) mark([[-6.4, 15.3], [-5.7, 15.3], [-5.7, 19.6], [-6.4, 19.6]], 0) torso(0.42);
color(gold) mark([[-2.9, 15.3], [-2.3, 15.3], [-2.3, 19.8], [-2.9, 19.8]], 0) torso(0.42);
color(red) mark([[-2.3, 15.3], [-1.6, 15.3], [-1.6, 20.0], [-2.3, 20.0]], 0) torso(0.42);
color(red) mark([[-7.1, 15.3], [-6.4, 15.3], [-6.4, 19.6], [-7.1, 19.6]], 0) torso(0.42);
// the back: a gold check lattice on the green
color(gold) intersection() {
  torso(0.4);
  translate([-3, 1.5, 15.9]) cube([6, 6, 4.4]);
  union() for (i = [-4 : 4]) for (a = [45, -45]) translate([i * 1.3, 0, 18]) rotate([0, a, 0]) translate([-0.18, 0, -5]) cube([0.36, 10, 10]);
}
// belt: gold with red and green checks, all round
BELT = [13.4, 15.2];
color(gold) intersection() { torso(0.55); translate([-10, -10, BELT[0]]) cube([20, 20, BELT[1] - BELT[0]]); }
color(red) intersection() {
  torso(0.7);
  translate([-10, -10, 14.3]) cube([20, 20, 0.9]);
  union() for (a = [0 : 30 : 330]) rotate([0, 0, a]) translate([-0.45, 0, 0]) cube([0.9, 30, 40]);
}
color(vestDk) intersection() {
  torso(0.7);
  translate([-10, -10, 13.4]) cube([20, 20, 0.9]);
  union() for (a = [15 : 30 : 345]) rotate([0, 0, a]) translate([-0.45, 0, 0]) cube([0.9, 30, 40]);
}
// hips and the cream belly
PELVIS = [[3.5, 3.0, 2.4], [0, 0.4, 11.4]];
ell(PELVIS[0], PELVIS[1], fur);
bellyPts = [[-5.8, 13.4], [-2.4, 13.4], [-2.5, 9.6], [-5.6, 9.6]];
color(cream) mark(bellyPts, 0) { ell(PELVIS[0] + [0.2, 0.2, 0.2], PELVIS[1]); torso(0.2); }
// the vest's flaps below the belt: a flared green skirt, open at the front, with pointed tails left and right
module skirt(g = 0) {
  hull() {
    translate([0, 0.3, 13.4]) scale([3.9 + g, 3.4 + g, 0.4]) sphere(1, $fn = 26);
    translate([0, 0.4, 11.6]) scale([4.3 + g, 3.7 + g, 0.4]) sphere(1, $fn = 26);
  }
}
color(vest) difference() { skirt(); prism(S([[-5.6, 9], [-2.4, 9], [-2.4, 14], [-5.6, 14]])); }
// the pointed tails: front left (on the hanging-scarf side), front right, and two at the back
module flapTip(p, rz) { color(vest) translate(p) rotate([0, 0, rz]) hull() { translate([-1.3, 0, 1.1]) sphere(0.45, $fn = 10); translate([1.3, 0, 1.1]) sphere(0.45, $fn = 10); translate([0, 0, -0.9]) sphere(0.3, $fn = 8); } }
flapTip([-3.6, -2.0, 11.2], -40);
flapTip([2.6, -3.0, 11.0], 25);
flapTip([2.4, 3.1, 11.2], -40);
flapTip([-2.4, 3.1, 11.2], 40);
// gold edge on the hem
color(gold) intersection() { skirt(0.08); translate([-10, -10, 11.2]) cube([20, 20, 0.45]); }

// ---- Arms: slim, out sideways, open hands palm up in orange gloves with tan fingers curled up
SHO = [3.9, -0.2, 19.8];
ELB = [7.0, -1.2, 17.3];
WRI = [9.9, -2.4, 16.6];
HAND = [10.9, -2.9, 16.5];
mirror_x() {
  limb(SHO, ELB, 1.2, 1.0, fur);
  limb(ELB, WRI, 1.0, 0.85, fur);
  limb(WRI, HAND, 0.95, 1.0, glove);
  ell([1.7, 1.55, 1.0], HAND + [0.4, -0.1, 0], glove);
  for (f = [[13.6, -2.6, 18.6], [13.1, -4.0, 18.9], [11.9, -4.9, 18.6]]) limb(HAND + [0.8, -0.3, 0.4], f, 0.5, 0.42, fur);
  limb(HAND + [-0.4, -1.0, 0.4], [9.8, -4.3, 17.9], 0.48, 0.4, fur);
}

// ---- Legs: big haunches, slim shins, long feet (the far foot turned out, the near one pointing forward)
HIP = [2.4, 0.5, 10.6];
HAUNCH = [[2.6, 2.8, 2.7], [3.8, 0.4, 8.8]];
KNEE = [5.2, -0.2, 6.6];
ANKLE = [6.0, -0.6, 3.4];
mirror_x() {
  color(fur) hull() {
    translate(HAUNCH[1]) scale(HAUNCH[0]) sphere(1, $fn = 22);
    translate(HIP) sphere(2.0, $fn = 16);
    translate(KNEE) sphere(1.3, $fn = 14);
  }
  limb(KNEE, ANKLE, 1.05, 0.8, fur);
}
// near foot (+X): pointing at the viewer, toe lines
limb(ANKLE, [6.2, -2.3, 1.7], 0.8, 0.8, fur);
ell([1.3, 1.5, 0.75], [6.2, -2.8, 1.65], fur);
for (dx = [-0.5, 0.5]) limb([6.2 + dx, -4.15, 1.75], [6.2 + dx, -4.25, 1.2], 0.12, 0.12, ink);
// far foot (-X): turned out
FFOOT = [-8.0, -1.9, 1.65];
limb([-ANKLE[0], ANKLE[1], ANKLE[2]], [-7.6, -1.6, 1.7], 0.8, 0.8, fur);
petal([1.9, 1.25, 0.75], FFOOT, [0, 0, 35], fur);
for (k = [-0.5, 0.5]) translate(FFOOT) rotate([0, 0, 35]) limb([-1.35, k, 1.75 - 1.65], [-1.45, k, 1.2 - 1.65], 0.12, 0.12, ink);

// ---- Tail: a big bushy plume behind the near side, a smooth chain of round segments on the art's spine (sheet x,
// sheet z, depth behind the picture plane, radius), sweeping down and out, then curling up to the tip
TAIL = [[0.4, 10.8, 3.0, 1.8], [4.4, 9.0, 4.6, 3.8], [8.6, 8.8, 5.8, 4.9], [12.6, 9.4, 6.2, 4.8], [14.4, 13.0, 6.2, 4.4],
        [15.2, 16.0, 6.0, 3.6], [16.8, 18.4, 5.8, 2.4], [18.8, 18.8, 5.6, 1.0]];
function tailP(t) = fs(t[0], t[1], t[2]);
module tailBody(g = 0) {
  for (i = [0 : len(TAIL) - 2]) hull() for (j = [i, i + 1])
    translate(tailP(TAIL[j])) scale([1, 0.85, 1]) sphere(TAIL[j][3] + g, $fn = 18);
}
color(fur) tailBody();
// the darker fold where the curl turns up over the lower lobe
foldPts = [[9.6, 12.8], [10.3, 13.1], [11.4, 16.6], [11.8, 17.4], [11.2, 17.2], [10.0, 13.6]];
color(furDk) intersection() { tailBody(0.2); prism(S(foldPts)); front(4.0); }

// ---- Oranges juggled in an arc round it (sheet positions), a stem and leaves on each, and the motion arcs
module fruit(p, r, leafRot) {
  color(orange) translate(p) scale([r, r * 0.95, r * 0.92]) sphere(1, $fn = 20);
  color(orangeHi) translate(p + [-r * 0.3, -r * 0.7, r * 0.45]) sphere(r * 0.28, $fn = 8);
  limb(p + [0, 0, r * 0.85], p + [0, 0, r * 1.2], r * 0.12, r * 0.1, leaf);
  color(leaf) translate(p + [0, 0, r * 1.15]) rotate(leafRot) translate([r * 0.55, 0, 0]) scale([r * 0.6, r * 0.18, r * 0.25]) sphere(1, $fn = 10);
}
FRUIT_A = fs(-14.1, 29.8, -1);
FRUIT_B = fs(-13.8, 22.0, -1);
FRUIT_C = fs(9.8, 25.0, -1);
fruit(FRUIT_A, 1.85, [0, -35, 180]);
fruit(FRUIT_B, 1.85, [0, -30, 180]);
fruit(FRUIT_C, 1.55, [0, -35, 0]);
// motion arcs: dashes of orange and green (thin; the rig hides them in game)
module arc(c, rx, rz, a0, a1, col) {
  for (a = [a0 : 10 : a1 - 10]) limb(c + [rx * cos(a), 0, rz * sin(a)], c + [rx * cos(a + 10), 0, rz * sin(a + 10)], 0.32, 0.32, col);
}
arc(fs(-14.2, 24.2, -1), 5.4, 3.3, 150, 210, swoosh);
arc(fs(-14.2, 24.2, -1) + [0.5, 0, 0], 5.4, 3.3, 165, 205, swooshG);
arc(fs(8.0, 25.3, -1), 5.6, 5.4, -40, 40, swoosh);
arc(fs(8.0, 25.3, -1) + [-0.5, 0, 0], 5.6, 5.4, -30, 20, swooshG);
