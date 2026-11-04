// Noxmyth: Lumyth's dark twin, a night sorceress spirit. A dark navy face set in a black hood with a red inner rim,
// glowing violet almond eyes under heavy black brows slanting down to the nose (a cold glare), a small flat mouth, an
// eclipse on the brow; a spiked iron crown with red-orange diamond gems; black hair flowing out of the hood on the
// right into a curl; navy plate armour (crescent on the chest, rounded pauldrons, a V belt, tassets) with FOUR arms:
// the upper pair raised with open palms, the lower pair held out palm up; dark bat-feather wings with a red root and
// an eclipsed sun on each; a tattered dark-red robe with flaps; a black hole on the belly from which a thick shadow
// tail with red and blue streaks swings right in an S and coils round a black orb with a glowing red ring; loose
// shadow strands hanging off the robe.
//
// Checklist (front sheet x, z; the art's body axis is at sheet x -1.5, so scad x 0 = sheet -1.5, OX below):
//   hood / head        x -8..4, z 25..36.5     black-navy, red rim round the face, eclipse on the back
//   face               x -6..1.5, z 26..33     navy; eyes at (-1.8, 29) near and (-5.6, 29) far, 1.7 wide almonds
//   brows              (-0.8, 30.6) -> (-3, 29.7) and (-6.3, 30.6) -> (-4.6, 29.6)
//   mouth              (-3.8, 27.2) flat line;  brow eclipse (-4, 31.6) r 0.9 + orange ring and rays
//   crown              band z 34..35.5, x -7.5..2.5; spikes peaking 38..40 (front centre tallest); gems at z 35
//   hair curl          (1, 34.5) -> (5, 36.3) -> (5.4, 37.4) hooks; locks flowing down past the cheeks
//   torso armour       z 15.5..26, crescent (-3.5, 23.6), pauldrons (0.9, 24.7) / (-6.2, 24.8), V belt tip (-3.6, 18.7)
//   upper arms         elbows (2, 22.3) / (-8.4, 22.7), palms raised at (3.8, 23.8) / (-9.2, 24.7)
//   lower arms         out to palms up at (4.8, 19.6) / (-10.6, 19.6)
//   wings              near x 2.6..17, z 22.6..34.8, sun (8.5, 26.8); far tip (-15.5, 35), sun (-10.6, 27.3)
//   robe flaps         dark red, out to (11.8, 15.5) / (-12.4, 15.4), z 13..20
//   belly black hole   (-3.2, 16.6)
//   tail               (-3, 14) r 3 -> (0, 11) -> (4, 10.3) -> (7.4, 6.5) -> (5.5, 4.6) -> the orb; upper loop (1..7.8, 10..14)
//   orb                centre (0.1, 3.6) r 3.2: dark coil, glowing red ring, black core
//   strands            far (-8.5, 15.5) -> (-11.9, 11.8) curl; (-7.5, 14) -> (-6, 8.2) hook; near (3.5, 16.5) -> (14.2, 11.2) curl
//   back               the hood's eclipse sun, a metal collar across the shoulders, a big red / blue swirl on the cape
include <lib.scad>

OX = 1.5;   // sheet x + OX = the scad's own sheet x
function S(sx, z, y = 0) = fromSheet(sx + OX, z, y);

hood = [0.12, 0.1, 0.21];
hoodIn = [0.07, 0.06, 0.13];
rimRed = [0.46, 0.1, 0.13];
faceC = [0.2, 0.23, 0.38];
ink = [0.04, 0.03, 0.08];
crownC = [0.3, 0.3, 0.36];
gem = [0.82, 0.34, 0.2, NOGLOW];
gold = [0.96, 0.72, 0.42, NOGLOW];
void = [0.03, 0.02, 0.05];
armour = [0.19, 0.19, 0.28];
trim = [0.44, 0.44, 0.5];
handC = [0.3, 0.32, 0.56];
robe = [0.3, 0.06, 0.1];
cape = [0.14, 0.08, 0.17];
tailC = [0.08, 0.08, 0.17];
tailRed = [0.55, 0.12, 0.14];
tailBlue = [0.18, 0.26, 0.46];
wingC = [0.13, 0.14, 0.28];
wingRed = [0.4, 0.09, 0.12];
wingHi = [0.68, 0.17, 0.15];
orbRed = [0.86, 0.12, 0.12, GLOW];
star = [0.86, 0.82, 0.96, NOGLOW];
iris = [0.7, 0.48, 1, GLOW];
sclera = [0.48, 0.24, 0.9, GLOW];
core = [0.97, 0.78, 1, GLOW];

// ---- helpers
module stripe2d(pts, w) {
  for (i = [0 : len(pts) - 2]) hull() { translate(pts[i]) circle(w, $fn = 8); translate(pts[i + 1]) circle(w, $fn = 8); }
}
// A stripe drawn on the FRONT sheet (art sheet coords), as a prism along the view.
module viewPaint(pts, w) {
  pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true) stripe2d([for (p = pts) [p[0] + OX, p[1]]], w);
}
// A stripe in scad (x, z), as a prism over the back half (y > 0).
module backPaint(pts, w) { rotate([90, 0, 0]) translate([0, 0, -60]) linear_extrude(60) stripe2d(pts, w); }
function spiral(c, R, turns, n = 16, ph = 0, dir = 1) =
  [for (i = [0 : n]) let(t = i / n, a = ph + dir * t * 360 * turns, rr = R * (0.1 + 0.9 * t)) c + [rr * cos(a), rr * sin(a)]];
module sparkle(p, s = 0.5, rz = 0) {
  color(star) translate(p) rotate([0, 0, rz]) {
    scale([s, 0.12, s * 0.22]) sphere(1, $fn = 6);
    scale([s * 0.22, 0.12, s]) sphere(1, $fn = 6);
  }
}
// A flat tapered ribbon (a robe flap): width ws[i] in the XZ plane, 2 t thick.
module ribbon(pts, ws, t, c) {
  color(c) for (i = [0 : len(pts) - 2]) hull() {
    translate(pts[i]) scale([ws[i], t, ws[i]]) sphere(1, $fn = 10);
    translate(pts[i + 1]) scale([ws[i + 1], t, ws[i + 1]]) sphere(1, $fn = 10);
  }
}
// An eclipsed sun facing -Y: a dark disc, a bright ring and n rays, r the disc's radius.
module sun(r, n = 8, t = 0.25) {
  color(gold) rotate([90, 0, 0]) linear_extrude(t, center = true) {
    difference() {
      union() {
        circle(r * 1.28, $fn = 20);
        for (a = [0 : 360 / n : 359]) rotate(a) polygon([[r * 1.1, -r * 0.28], [r * 2.1, 0], [r * 1.1, r * 0.28]]);
      }
      circle(r, $fn = 20);
    }
  }
  color(void) rotate([90, 0, 0]) linear_extrude(t + 0.1, center = true) circle(r, $fn = 20);
}

// ---- head: the hood with the face set in it
HOOD = [[5.6, 4.9, 5.6], [0, 0.2, 30.8]];
FACE = [[3.9, 3.4, 4.0], [0, -1.8, 29.6]];
color(hood) difference() {
  ell(HOOD[0], HOOD[1]);
  translate([0, -2.4, 29.6]) rotate([90, 0, 0]) cylinder(h = 10, r = 3.75, $fn = 32);
}
// the hood's drape over the nape and shoulders
blob([[[4.6, 3.8, 3.2], [0, 1.6, 27.4]], [[3.8, 3.4, 2], [0, 2, 25.4]]], hood);
color(hoodIn) translate([0, -2.0, 29.6]) rotate([90, 0, 0]) cylinder(h = 0.8, r = 3.8, $fn = 32);
color(faceC) translate(FACE[1]) scale(FACE[0]) sphere(1, $fn = 32);
// red inner rim of the hood round the face
color(rimRed) intersection() {
  ell(HOOD[0] + [0.12, 0.12, 0.12], HOOD[1]);
  translate([0, -2.2, 29.6]) rotate([90, 0, 0]) linear_extrude(10) difference() { circle(4.45, $fn = 32); circle(3.75, $fn = 32); }
}
// red streaks over the hood's top right (front)
color(rimRed) intersection() { ell(HOOD[0] + [0.15, 0.15, 0.15], HOOD[1]); viewPaint([[0.2, 34.2], [2.4, 33.6], [4.4, 33.2]], 0.35); }

// eyes: glowing violet almonds, a pink-white core, hooded by a lid slanting down to the nose, a lower lid
EYE = [2.17, -4.25, 29.05];
mirror_x() {
  // the black lids are the art's heavy brow and eyeliner: the upper one slants down to the nose
  eye(EYE, 0.95, iris = iris, sclera = sclera, pupil = core, yaw = 26, lid = 0.36, lid_tilt = 22, lid_c = ink,
      squint = 0.16, slit = 0.75, shine = true);
  // the brow runs on past the inner corner towards the nose
  color(ink) hull() {
    translate([1.6, -4.85, 29.75]) scale([0.3, 0.25, 0.22]) sphere(1, $fn = 8);
    translate([0.75, -5.1, 29.5]) scale([0.25, 0.25, 0.2]) sphere(1, $fn = 8);
  }
}
// small flat mouth
color(ink) translate([0, -4.5, 27.25]) rotate([0, 4, 0]) scale([0.75, 0.25, 0.16]) sphere(1, $fn = 10);
// eclipse on the brow
translate([0, -4.75, 31.65]) rotate([-28, 0, 0]) sun(0.8, 8, 0.3);

// back of the hood: an eclipsed sun and red streaks
translate([0.6, 5.0, 32.4]) rotate([0, 0, 180]) rotate([-20, 0, 0]) sun(1.0, 8, 0.4);
color(rimRed) intersection() { ell(HOOD[0] + [0.15, 0.15, 0.15], HOOD[1]); backPaint(spiral([0.6, 32.4], 3.6, 0.9, 12, 200, -1), 0.32); }

// ---- crown: an iron band with blade spikes, the front one tallest, red-orange diamond gems
SPK = [5.4, 3.4, 3.9, 3.0, 2.5, 2.3, 2.2];   // spike heights by |angle| / 30 from the front
translate([0, -0.4, 34.1]) rotate([8, 0, 0]) {
  color(crownC) scale([4.5, 4.0, 1]) difference() { cylinder(h = 1.5, r = 1, $fn = 26); translate([0, 0, -1]) cylinder(h = 4, r = 0.88, $fn = 26); }
  for (k = [0 : 11]) let(a = k * 30, i = min(k, 12 - k), p = [4.35 * sin(a), -3.85 * cos(a), 1.2])
    color(crownC) translate(p) rotate([0, 0, -a]) hull() {
      cube([i == 0 ? 1.5 : 1.2, 0.45, 0.2], center = true);
      translate([0, 0, SPK[i]]) sphere(0.08, $fn = 4);
    }
  // gems on the band's front
  for (g = [[0, 0.95, 0.55], [32, 0.6, 0.38], [-32, 0.6, 0.38]]) let(a = g[0])
    color(gem) translate([4.6 * sin(a), -4.2 * cos(a), 0.8]) rotate([0, 0, -a]) scale([g[2], 0.3, g[1]]) rotate([0, 45, 0]) cube([1.414, 1, 1.414], center = true);
}

// ---- hair: the curl rising out of the hood to the right, the locks falling past the cheeks
CURL = [S(1, 34.6, 1), S(3.4, 35.4, 1), S(5.0, 36.2, 1), S(5.8, 37.4, 1), S(5.2, 38.4, 1), S(4.0, 38.2, 1)];
CURL_R = [1.7, 1.45, 1.25, 1.0, 0.7, 0.3];
chain(CURL, CURL_R, hood);
color(rimRed) intersection() { chain(CURL, [for (r = CURL_R) r + 0.12]); viewPaint([[0.6, 34.4], [3, 35], [4.6, 35.8]], 0.3); }
LOCK = [[4.6, 0.6, 32.6], [6.2, 0.9, 30.6], [5.8, 1.3, 28.6], [4.8, 1.6, 26.6], [4.4, 1.8, 24.6]];
LOCK_R = [1.6, 1.35, 1.2, 1.0, 0.7];
mirror_x() {
  chain(LOCK, LOCK_R, hood);
  color(rimRed) intersection() {
    chain(LOCK, [for (r = LOCK_R) r + 0.12]);
    translate([0, -10, 0]) rotate([90, 0, 0]) translate([0, 0, -12]) linear_extrude(24) stripe2d([[4.8, 32.6], [6.7, 30.6], [6.3, 28.4], [5.2, 26.4]], 0.32);
  }
}

// ---- torso: plate armour, a crescent on the chest, a metal collar, a V belt
TORSO = [[[2.9, 2.3, 2.1], [0, -0.6, 24.2]], [[2.4, 2.0, 2.0], [0, -0.6, 21.0]]];
blob(TORSO, armour);
color(gold) translate([0, -2.95, 23.7]) rotate([90, 0, 0]) linear_extrude(0.4, center = true)
  difference() { circle(0.85, $fn = 16); translate([-0.42, 0.22]) circle(0.74, $fn = 16); }
// collar round the neck (reads as the metal band across the shoulders from behind)
color(trim) translate([0, 0.2, 26.2]) scale([1, 0.92, 1]) rotate_extrude($fn = 28) translate([3.0, 0]) scale([0.4, 0.7]) circle(1, $fn = 8);
// V belt: two trim bars meeting under the chest, a ridge down the middle plate
color(trim) intersection() {
  blob([[[2.6, 2.2, 2.1], [0, -0.6, 21.0]]]);
  viewPaint([[-6.0, 21.2], [-3.8, 18.8], [0.4, 20.8]], 0.32);
}
color(trim) intersection() { blob([[[2.55, 2.15, 2.1], [0, -0.6, 21.6]]]); viewPaint([[-3.8, 22.2], [-3.8, 19.8]], 0.16); }
// pauldrons: rounded shells with a trim rim and a point on top
PAUL = [3.5, -0.4, 25.0];
mirror_x() {
  ell([2.1, 2.0, 1.5], PAUL, armour);
  color(trim) translate(PAUL + [0, 0, -0.55]) scale([2.05, 1.95, 1]) rotate_extrude($fn = 24) translate([1, 0]) scale([0.12, 0.3]) circle(1, $fn = 6);
  spike(PAUL + [0.4, -0.2, 1.1], [0.5, -0.1, 1.2], 0.6, 0.05, armour);
}
// tassets: an armoured skirt under the belt with a trim hem
lathe([[2.4, 19.6], [3.0, 18.4], [3.7, 16.6], [3.9, 15.6]], armour, 28);
color(trim) translate([0, 0, 15.75]) rotate_extrude($fn = 28) translate([3.85, 0]) scale([0.2, 0.3]) circle(1, $fn = 6);

// ---- four arms: the upper pair raised with open palms, the lower pair held out palm up
module hand(c) {
  color(c) {
    scale([0.75, 0.45, 0.8]) sphere(1, $fn = 12);
    for (f = [[-0.5, 0], [-0.17, 0.05], [0.17, 0.05], [0.5, 0]]) hull() {
      translate([f[0], f[1], 0.45]) sphere(0.2, $fn = 6);
      translate([f[0] * 1.25, f[1] - 0.1, 1.3]) sphere(0.15, $fn = 6);
    }
    hull() { translate([0.6, -0.1, -0.1]) sphere(0.2, $fn = 6); translate([1.15, -0.3, 0.4]) sphere(0.15, $fn = 6); }
  }
}
SH1 = [3.4, -0.3, 24.0]; EL1 = [5.8, -1.0, 22.4]; HA1 = [7.2, -2.2, 24.2];
SH2 = [2.6, -0.4, 20.4]; EL2 = [5.0, -1.4, 19.6]; HA2 = [7.6, -2.4, 19.9];
mirror_x() {
  limb(SH1, EL1, 0.85, 0.75, armour);
  limb(EL1, HA1 + [-0.35, 0.3, -0.5], 0.75, 0.65, armour);
  color(trim) translate(EL1 + (HA1 - EL1) * 0.62) rotate(_dir_rot(HA1 - EL1)) cylinder(h = 0.4, r = 0.78, center = true, $fn = 12);
  translate(HA1) rotate([0, 18, -20]) hand(handC);
  limb(SH2, EL2, 0.85, 0.75, armour);
  limb(EL2, HA2 + [-0.6, 0, 0], 0.75, 0.65, armour);
  for (t = [0.35, 0.7]) color(trim) translate(EL2 + (HA2 - EL2) * t) rotate(_dir_rot(HA2 - EL2)) cylinder(h = 0.35, r = 0.8, center = true, $fn = 12);
  // palm up, fingers curled up and out
  translate(HA2) rotate([0, 62, -15]) hand(handC);
}

// ---- the back cape: a dark shell from the shoulders, the big red / blue swirl on its back
module capeHull(k = 0) {
  union() {
    hull() {
      translate([0, 1.4, 25.4]) scale([3.6 - k, 2.4 - k, 0.4]) sphere(1, $fn = 18);
      translate([0, 2.4, 21.0]) scale([6.2 - k, 4.0 - k, 0.4]) sphere(1, $fn = 22);
    }
    hull() {
      translate([0, 2.4, 21.0]) scale([6.2 - k, 4.0 - k, 0.4]) sphere(1, $fn = 22);
      translate([0, 2.6, 14.0]) scale([7.0 - k, 4.6 - k, 0.4]) sphere(1, $fn = 22);
    }
  }
}
module capeCut() { translate([0, -8.6, 18]) cube([40, 16, 30], center = true); }
color(cape) difference() { capeHull(0); capeHull(0.4); capeCut(); }
color(hoodIn) difference() { capeHull(0.4); capeHull(0.75); capeCut(); translate([0, 0, 25.6]) cube([40, 40, 4], center = true); }
module capePaint(pts, w) { intersection() { difference() { capeHull(-0.15); capeHull(0.1); } backPaint(pts, w); translate([0, 25, 18]) cube([40, 40, 30], center = true); } }
color(tailRed) capePaint(spiral([-0.6, 19.6], 5.0, 1.6, 22, 0), 0.6);
color(tailBlue) capePaint(spiral([-0.6, 19.6], 4.4, 1.3, 18, 180), 0.42);
color(void) capePaint([[-0.6, 19.6], [-0.4, 19.7]], 0.75);
for (p = [[-4.4, 6.6, 17.6], [4.6, 6.8, 16.6], [2.6, 5.4, 23.2], [-3.2, 5.6, 22.6]]) sparkle(p, 0.45, atan2(p[0], 8));

// ---- the robe: a dark-red skirt under the tassets, tattered flaps flaring out at the sides
lathe([[2.6, 19.4], [3.4, 17.6], [4.3, 15.4], [4.6, 13.8], [4.0, 13.4]], cape, 24);
FLAP1 = [[3.6, 0.6, 19.4], [7.0, 0.8, 19.0], [10.4, 0.8, 17.9], [12.8, 0.6, 16.6], [13.6, 0.4, 15.4]];
FLAP2 = [[4.0, -0.4, 17.8], [6.4, -0.6, 16.4], [8.0, -0.6, 14.6], [8.5, -0.6, 13.5]];
FLAP3 = [[3.4, 1.6, 17.0], [5.4, 2.0, 14.6], [6.0, 2.2, 12.2], [5.8, 2.2, 11.2]];
mirror_x() {
  ribbon(FLAP1, [1.8, 1.9, 1.5, 0.9, 0.15], 0.35, robe);
  color(tailRed) intersection() { ribbon(FLAP1, [1.3, 1.4, 1.1, 0.6, 0.1], 0.42); translate([0, 0, 18.6]) cube([40, 40, 1.2], center = true); }
  ribbon(FLAP2, [1.7, 1.5, 0.8, 0.12], 0.35, robe);
  ribbon(FLAP3, [1.3, 1.1, 0.6, 0.1], 0.35, cape);
}

// ---- the shadow tail: out of the black hole on the belly, swinging right in an S and coiling round the orb
COL = [S(-3.2, 16.4, -0.8), S(-3.0, 14.2, -0.6), S(-2.4, 12.2, -0.4), S(0, 10.9, -0.2), S(3.6, 10.2, 0), S(6.4, 8.8, 0),
       S(7.4, 6.6, 0), S(6.2, 4.8, 0), S(4.0, 4.5, 0), S(2.4, 5.4, 0)];
COL_R = [2.4, 2.9, 2.7, 2.3, 1.9, 1.6, 1.4, 1.2, 1.0, 0.8];
COL_SY = 0.8;
scale([1, COL_SY, 1]) chain(COL, COL_R, tailC, $fs = 1);
module colGrown(g) { scale([1, COL_SY, 1]) chain(COL, [for (r = COL_R) r + g], $fs = 1); }
color(tailRed) intersection() { colGrown(0.15); viewPaint([[-4.2, 15.4], [-4.0, 13], [-2.6, 11.2], [0.6, 10.1], [4.4, 9.4], [6.8, 7.8], [7.3, 6.2]], 0.4); }
color(tailBlue) intersection() { colGrown(0.15); viewPaint([[-5.6, 14.6], [-5.0, 12.2], [-3.4, 10.4], [0, 9.6], [3.6, 9.0]], 0.36); }
color(tailBlue) intersection() { colGrown(0.15); backPaint([[-1, 16], [-0.5, 12.5], [2, 10.2], [5, 8.6]], 0.4); }
// the upper loop of the S
UP = [S(-1.6, 14.2, 0.6), S(1.8, 13.7, 0.6), S(4.6, 13.2, 0.6), S(6.8, 12.4, 0.6), S(7.8, 10.8, 0.5), S(7.2, 9.2, 0.3)];
UP_R = [1.2, 1.1, 1.0, 0.9, 0.85, 0.8];
chain(UP, UP_R, tailC);
color(tailRed) intersection() { chain(UP, [for (r = UP_R) r + 0.12]); viewPaint([[0.4, 13.8], [4.4, 13.0], [6.9, 11.8]], 0.28); }
// the black hole on the belly: a void with a red swirl round it
translate(S(-3.2, 16.7, -2.9)) rotate([0, 0, 30]) {
  color(void) scale([1.3, 0.6, 1.5]) sphere(1, $fn = 16);
  color(tailRed) rotate([90, 0, 0]) rotate_extrude($fn = 20) translate([1.45, 0]) scale([0.25, 0.4]) circle(1, $fn = 6);
}
for (p = [S(-1, 13.5, -2.4), S(1.5, 11.2, -2.0), S(5.4, 9.6, -1.5)]) sparkle(p, 0.4, 30);

// ---- the orb: a dark coiled pillow facing the view, a glowing red ring, a black core
ORB = [[3.3, 2.0, 3.3], [0.1 + OX, 0, 3.4]];   // in the picture plane (pp)
pp(0) {
  ell(ORB[0], ORB[1], tailC);
  color(orbRed) intersection() { ell(ORB[0] + [0, 0.15, 0], ORB[1]); rotate([90, 0, 0]) linear_extrude(10) translate([ORB[1][0], ORB[1][2]]) difference() { circle(2.15, $fn = 24); circle(1.3, $fn = 20); } }
  color(void) intersection() { ell(ORB[0] + [0, 0.2, 0], ORB[1]); rotate([90, 0, 0]) linear_extrude(10) translate([ORB[1][0], ORB[1][2]]) circle(1.3, $fn = 20); }
  color(tailRed) intersection() { ell(ORB[0] + [0, 0.12, 0], ORB[1]); rotate([90, 0, 0]) linear_extrude(10) stripe2d(spiral([ORB[1][0], ORB[1][2]], 3.0, 0.45, 8, 120, -1), 0.25); }
}

// ---- loose shadow strands hanging off the robe
STR1 = [S(-8.5, 15.6, 0.5), S(-10.5, 13.6, 0.5), S(-11.9, 11.8, 0.5), S(-11.8, 10.6, 0.5), S(-10.8, 10.3, 0.5)];
STR2 = [S(-7.2, 14.4, -0.5), S(-8.6, 11.8, -0.5), S(-7.2, 9.6, -0.5), S(-6.0, 8.2, -0.5), S(-6.6, 7.6, -0.5), S(-7.3, 7.8, -0.5)];
STR3 = [S(3.6, 16.4, 1), S(7.5, 15.0, 1), S(10.7, 13.7, 1), S(13.4, 12.8, 1), S(14.2, 11.2, 1), S(13.4, 10.1, 1), S(12.6, 10.2, 1)];
chain(STR1, [0.8, 0.7, 0.55, 0.4, 0.15], tailC);
chain(STR2, [0.8, 0.65, 0.55, 0.45, 0.3, 0.1], tailC);
chain(STR3, [1.0, 0.9, 0.8, 0.65, 0.5, 0.3, 0.1], tailC);
color(tailRed) intersection() { chain(STR3, [1.12, 1.02, 0.92, 0.77, 0.62, 0.4, 0.2]); viewPaint([[5, 15.8], [8.6, 14.4], [11.6, 13.2]], 0.26); }

// ---- wings: dark bat-feather wings, a red root with a bright streak, an eclipsed sun on both faces
WING = [[2.6, 24.6], [4.6, 27], [6, 28.8], [7.5, 29.8], [9.2, 30.2], [11.3, 30.6], [13.8, 31.4], [15.5, 32.9], [16.8, 34.8],
        [17, 33.6], [16.3, 31.8], [15.2, 30.6], [14, 29.9], [14.9, 28.3], [14.2, 27.6], [12.5, 27.2], [11.4, 27.0],
        [12.9, 26.4], [12, 25.8], [10.4, 25.2], [8.6, 24.7], [11.5, 23.6], [10.2, 22.6], [8.2, 22.6], [6.1, 23.4],
        [5.2, 24.2], [2.6, 24.2]];
WRED = [[2, 23.8], [2, 25.4], [4.6, 27.6], [6.6, 27.8], [7.4, 26.6], [8.0, 24.9], [9.4, 24.0], [10.6, 22.2], [6, 22.8]];
WY = 3.4;
function wpt(p) = [(p[0] + OX - 0.5 * WY) / 0.866, p[1] - 0.17 * WY];
module wingFlat(t, c, g = 0.45) { translate([0, WY, 0]) plate([for (p = WING) wpt(p)], t, 0.3, c, g); }
module wingPaint(t, c, pts) { color(c) intersection() { wingFlat(t, undef); translate([0, WY, 0]) rotate([90, 0, 0]) linear_extrude(4, center = true) polygon([for (p = pts) wpt(p)]); } }
SUN = wpt([8.5, 26.8]);
WROOT = [2.8, WY, 24];   // the wings swing back WSW degrees about their root and shrink to WS
WSW = 6; WS = 0.96;
mirror_x() translate(WROOT) rotate([0, 0, WSW]) scale(WS) translate(-WROOT) {
  wingFlat(0.9, wingC);
  wingPaint(1.0, wingRed, WRED);
  color(wingHi) intersection() { wingFlat(1.1, undef); translate([0, WY, 0]) rotate([90, 0, 0]) linear_extrude(4, center = true) stripe2d([for (p = [[2.8, 24.6], [5.2, 26.6], [7.2, 28.0]]) wpt(p)], 0.26); }
  color(wingHi) intersection() { wingFlat(1.1, undef); translate([0, WY, 0]) rotate([90, 0, 0]) linear_extrude(4, center = true) stripe2d([for (p = [[4.6, 24.9], [7.4, 24.6], [9.8, 23.2]]) wpt(p)], 0.24); }
  translate([SUN[0], WY - 0.5, SUN[1]]) sun(0.9, 8, 0.25);
  translate([SUN[0], WY + 0.5, SUN[1]]) rotate([0, 0, 180]) sun(0.9, 8, 0.25);
}
