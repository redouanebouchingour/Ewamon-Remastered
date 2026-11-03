// Archonosis: a floating sorcerer. Sprite-matched 2026-11-03.
// Checklist (front sheet, 40 units tall, art x; the body axis lands on sheet x 0.9, so art parts sit in art()):
//   - face: a pale bone mask (x -3.5..2.7, z 27.4..35.2), a rounded dome widest at z 30..33, tapering to a square
//     chin; FIVE magenta almond eyes with ink rims and pink highlights: a tall vertical one on the forehead (with a
//     slit pupil), two small slanted ones beside it and two bigger slanted ones below, every outer corner up.
//   - head: turned about 15 degrees further towards the viewer than the body; a purple cowl round the mask whose back
//     bulges out behind (the back art), and behind it a tall purple fan (x -5.8..6.9, z 29..40) with a pale trim, a
//     notch in its top and four pink studs round the mask.
//   - robe: magenta, a flared bell (hem x -7.7..9.3 at z 12) with a navy hem band, open down the front over a navy
//     underrobe, lavender trim on the opening, a pink brooch at the throat (-0.85, 24.8); a high collar of two pointed
//     wings with trim, tips at (-6.5, 30.5) and (8.3, 31.5).
//   - sleeves: dark indigo bells hanging to z 15, open cuffs (black inside) facing the viewer; hands lilac, held out
//     palm up above the cuffs: the viewer's right one open, fingers spread (x 7.6..12.2, z 19.5..23.5), a lilac shard
//     sticking out of that upper sleeve (x 8.6..12.5, z 25.5..28.5); the viewer's left one cups the orb.
//   - orb: a swirling blue vortex (centre -7.45, 24.85, r 3.8), pale cyan spiral arms, blue flame wisps round it.
//   - tail: no legs; a broad violet ghost tail out of the hem curling in an S down to the ground and ending in a thin
//     tip curled up at the right (7.6, 2.5), a pale blue streak along it, two loose wisp flecks at the left.
//   - back: the fan and cowl from behind, the collar wings, the magenta cape to the bell hem, the tail.
include <lib.scad>

mask = [0.92, 0.88, 0.74, NOGLOW];
eyeInk = [0.22, 0.03, 0.28];
eyeMag = [0.8, 0.16, 0.76, NOGLOW];
eyeHi = [1, 0.65, 0.97, NOGLOW];
hood = [0.33, 0.22, 0.6];
fan = [0.27, 0.16, 0.52];
fanTrim = [0.62, 0.66, 0.86, NOGLOW];
robe = [0.52, 0.07, 0.42];
trim = [0.42, 0.5, 0.84];
under = [0.13, 0.19, 0.46];
hem = [0.13, 0.26, 0.51];
sleeve = [0.19, 0.15, 0.42];
cuffIn = [0.05, 0.03, 0.12];
hand = [0.52, 0.4, 0.8];
shard = [0.6, 0.5, 0.86, NOGLOW];
orbBody = [0.36, 0.56, 0.92];
orbSwirl = [0.7, 0.93, 0.98, GLOW];
flame = [0.4, 0.52, 0.95];
tailC = [0.38, 0.22, 0.68];
streak = [0.47, 0.58, 0.92, NOGLOW];

SX = 0.9;       // the sheet x of the body axis
HX = -1.3;      // the head's axis (scad x)
HY = 15;        // the head's extra turn towards the viewer

// Children authored in ABSOLUTE sheet coordinates (x = art x, z = art z, +y = depth away from the viewer).
module art(d = 0) { pp(d) translate([-SX, 0, 0]) children(); }
// Children in the head's own frame: x across the face, -y out of it, z the sheet's z.
module headFrame() { translate([HX, 0, 0]) rotate([0, 0, HY]) children(); }

// A pointed almond, long axis along u.
module almond2d(L, H) {
  R = ((L / 2) * (L / 2) + (H / 2) * (H / 2)) / H;
  d = R - H / 2;
  intersection() { translate([0, -d]) circle(R, $fn = 48); translate([0, d]) circle(R, $fn = 48); }
}
// The almond's prism out of the head's front, centred at (x, z), tilted `tilt` degrees from horizontal.
module eyePrism(x, z, L, H, tilt) {
  translate([x, 0, z]) rotate([90, 0, 0]) linear_extrude(height = 12) rotate(tilt) almond2d(L, H);
}

// ---- Head (in headFrame) ----
MASK = [[[3.3, 2.6, 2.5], [0, -0.4, 32.7]], [[3.1, 2.4, 1.2], [0, -0.6, 30.4]], [[1.0, 1.3, 0.7], [0, -1.8, 28.1]]];
module maskVol(g) { hull() for (e = MASK) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 32); }

// The five eyes: [x, z, L, H, tilt].
EYES = [[0, 32.9, 3.9, 1.5, 90], [1.95, 32.35, 2.15, 1.25, 40], [-1.95, 32.35, 2.15, 1.25, 140],
        [1.85, 30.25, 2.7, 1.6, 42], [-1.85, 30.25, 2.7, 1.6, 138]];

// Fan outline (head x, z), symmetric, with the notch in its top.
FAN = [[0.7, 39.8], [0.7, 37], [0.4, 36.4], [0, 36.2], [-0.4, 36.4], [-0.7, 37], [-0.7, 39.8], [-1.7, 39.9], [-3.2, 39.3],
       [-4.5, 38.2], [-5.4, 36.8], [-5.8, 35], [-5.8, 33], [-5.4, 31.2], [-4.5, 29.8], [-3.0, 29], [0, 28.8], [3.0, 29],
       [4.5, 29.8], [5.4, 31.2], [5.8, 33], [5.8, 35], [5.4, 36.8], [4.5, 38.2], [3.2, 39.3], [1.7, 39.9]];
// The fan is a cupped shell: a slice of an elliptic cylinder centred 4 units in front of the head axis.
module fanShell(g) {
  difference() {
    translate([0, -4, 28]) scale([7.6 + g, 5.5 + g, 1]) cylinder(h = 13, r = 1, $fn = 64);
    translate([0, -4, 27]) scale([6.8 - g, 4.6 - g, 1]) cylinder(h = 15, r = 1, $fn = 64);
    translate([-20, -44, 20]) cube([40, 41, 30]);   // keep the back half only
  }
}
module fanCut(grow) { rotate([90, 0, 0]) linear_extrude(height = 30, center = true) offset(r = grow) polygon(FAN); }

// A pink stud on the fan: a domed almond on an ink rim.
module stud(x, z, tilt, yaw) {
  y = -4 + 4.6 * sqrt(1 - (x / 6.8) * (x / 6.8));
  translate([x, y, z]) rotate([0, 0, yaw]) {
    color(eyeInk) intersection() { scale([1.1, 0.45, 1.1]) sphere(1, $fn = 16); rotate([90, 0, 0]) linear_extrude(height = 2, center = true) rotate(tilt) almond2d(1.75, 1.0); }
    color(eyeMag) intersection() { translate([0, -0.12, 0]) scale([0.95, 0.5, 0.95]) sphere(1, $fn = 16); rotate([90, 0, 0]) linear_extrude(height = 2, center = true) rotate(tilt) almond2d(1.4, 0.7); }
    color(eyeHi) translate([0, -0.55, 0.05]) scale([0.22, 0.12, 0.22]) sphere(1, $fn = 8);
  }
}

headFrame() {
  // Cowl: wraps the head behind and round the mask, bulging out behind the fan.
  color(hood) hull() { translate([0, 1.4, 31.8]) scale([3.4, 3.2, 3.5]) sphere(1, $fn = 32); translate([0, 1.0, 28.6]) scale([2.2, 2.2, 1.4]) sphere(1, $fn = 20); }
  // Mask and its five gem eyes, laid on the curved mask as shells.
  color(mask) maskVol(0);
  for (e = EYES) {
    color(eyeInk) intersection() { maskVol(0.1); eyePrism(e[0], e[1], e[2] + 0.4, e[3] + 0.35, e[4]); }
    color(eyeMag) intersection() { maskVol(0.2); eyePrism(e[0], e[1], e[2], e[3], e[4]); }
    color(eyeHi) intersection() { maskVol(0.3); eyePrism(e[0], e[1] + 0.12, e[2] * 0.36, e[3] * 0.4, e[4]); }
  }
  // the forehead eye's slit pupil
  color(eyeInk) intersection() { maskVol(0.35); eyePrism(0, 32.75, 1.5, 0.26, 90); }
  // Fan: pale trim rim, purple inside on both faces.
  color(fanTrim) intersection() { fanShell(0); fanCut(0.45); }
  color(fan) intersection() { fanShell(0.1); fanCut(-0.15); }
  stud(3.5, 35.6, 45, -20); stud(-3.5, 35.6, 135, 20);
  stud(4.3, 33.2, 20, -27); stud(-4.3, 33.2, 160, 27);
}

// ---- Robe ----
ROBE = [[9.0, 12.3], [8.7, 13.6], [7.7, 15.5], [6.6, 18], [5.6, 21], [4.9, 24], [4.6, 26], [4.0, 27.8], [2.8, 28.8], [1.6, 29.3]];
module robeVol(g) {
  scale([1, 0.8, 1]) rotate_extrude($fn = 40) polygon(concat([[0, ROBE[0][1]]], [for (p = ROBE) [p[0] + g, p[1]]], [[0, ROBE[len(ROBE) - 1][1]]]));
  mirror_x() translate([4.6, 0.3, 26.3]) scale([2.4 + g, 2.2 + g, 1.9 + g]) sphere(1, $fn = 24);
}
color(robe) robeVol(0);
// navy hem band
color(hem) intersection() { robeVol(0.15); translate([-20, -20, 11]) cube([40, 40, 2.7]); }
// The open front: navy underrobe between lavender-trimmed edges (front half only).
OPEN = [[-2.0, 27.2], [0.4, 27.2], [0.9, 22], [1.8, 17], [2.6, 13], [2.8, 11], [-4.8, 11], [-4.4, 13.5], [-3.4, 18], [-2.8, 22]];
module front(pts, grow) {
  intersection() {
    art(0) rotate([90, 0, 0]) linear_extrude(height = 60, center = true) offset(r = grow) polygon(pts);
    art(0) translate([-30, -40, 0]) cube([60, 40, 40]);
  }
}
color(trim) intersection() { robeVol(0.22); front(OPEN, 0.55); }
color(under) intersection() { robeVol(0.3); front(OPEN, 0); }
// brooch at the throat
color(eyeInk) translate(fromSheet(-0.85 - SX, 24.8, -4.0)) scale([0.75, 0.5, 1.05]) sphere(1, $fn = 12);
color(eyeMag) translate(fromSheet(-0.85 - SX, 24.8, -4.3)) scale([0.55, 0.45, 0.85]) sphere(1, $fn = 12);

// High collar: two pointed wings standing behind the shoulders, magenta with a pale trim rim.
COLLAR = [[0.8, 25.0], [1.5, 27.0], [3.0, 27.9], [6.0, 29.4], [8.9, 32.2], [8.1, 28.6], [6.6, 25.6]];
mirror_x() translate([0, 0.9, 0]) {
  color(trim) plate(COLLAR, t = 0.7, grow = 0.9);
  color(robe) plate(COLLAR, t = 1.3);
}

// ---- Sleeves: bells from the shoulders, open cuffs turned to the viewer ----
module cuffDisk(s) { rotate([0, 0, 30]) rotate([35, 0, 0]) scale(s) sphere(1, $fn = 28); }
module sleeveBell(sh, cuff, elbow) {
  color(sleeve) hull() { translate(sh) sphere(1.6); translate(elbow) sphere(1.5); translate(cuff) cuffDisk([2.4, 0.35, 2.7]); }
  color(cuffIn) translate(cuff + [0.1, -0.2, 0]) cuffDisk([1.9, 0.3, 2.2]);
}
sleeveBell([5.0, 0.4, 25.3], fromSheet(8.4 - SX, 17.9, -2), fromSheet(9.3 - SX, 25.0, -1.5));
sleeveBell([-5.0, 0.4, 25.3], fromSheet(-7.0 - SX, 17.9, -3), fromSheet(-6.0 - SX, 23.0, -1.5));

// Right hand (the viewer's right), open, fingers spread up and out; the lilac shard above it.
art(-7) {
  color(hand) translate([9.6, 0, 21.7]) scale([1.7, 0.8, 1.5]) sphere(1, $fn = 20);
  color(hand) for (f = [[[10.6, 22.6], [12.0, 23.5]], [[10.9, 22.0], [12.4, 22.5]], [[10.9, 21.3], [12.3, 21.3]], [[10.6, 20.7], [11.7, 20.2]], [[8.6, 21.6], [7.7, 21.8]]])
    limb([f[0][0], 0, f[0][1]], [f[1][0], 0, f[1][1]], 0.5, 0.36);
}
art(-2.5) color(shard) translate([10.3, 0, 27.0]) rotate([0, -38, 0]) scale([2.3, 0.6, 0.72]) sphere(1, $fn = 18);

// Left hand (the viewer's left) cupping the orb from below, fingers up its side.
art(-0.5) {
  color(hand) translate([-9.0, 0, 20.6]) scale([1.7, 1.3, 0.85]) sphere(1, $fn = 20);
  color(hand) for (f = [[[-11.0, 20.9], [-11.6, 22.6]], [[-10.2, 20.8], [-10.5, 23.0]], [[-9.2, 20.7], [-9.3, 22.7]], [[-8.2, 20.6], [-8.0, 22.2]]])
    limb([f[0][0], -1.2, f[0][1]], [f[1][0], -1.6, f[1][1]], 0.42, 0.34);
}

// ---- Vortex orb: a blue ball, three pale spiral arms on each face, flame wisps round it ----
ORB = [-7.45, 0, 24.85];
OR = 3.6;
art(0) translate(ORB) {
  color(orbBody) sphere(OR, $fn = 30);
  for (side = [-1, 1]) for (a0 = [0, 120, 240]) color(orbSwirl)
    for (i = [0 : 6]) let(t0 = i / 7, t1 = (i + 1) / 7, r0 = 0.3 + 3.2 * t0, r1 = 0.3 + 3.2 * t1,
                         a = a0 + 250 * t0, b = a0 + 250 * t1)
      hull() {
        translate([r0 * cos(a), side * sqrt(OR * OR - r0 * r0), r0 * sin(a)]) sphere(0.62 - 0.22 * t0, $fn = 8);
        translate([r1 * cos(b), side * sqrt(OR * OR - r1 * r1), r1 * sin(b)]) sphere(0.62 - 0.22 * t1, $fn = 8);
      }
}
art(0.6) {
  chain([[-11.5, 0, 27.0], [-10.3, 0, 28.7], [-8.6, 0, 29.3], [-7.0, 0, 28.8]], [0.7, 0.6, 0.45, 0.2], flame);
  chain([[-11.9, 0, 23.5], [-12.6, 0, 25.5], [-12.4, 0, 27.5], [-11.6, 0, 28.6]], [0.4, 0.7, 0.6, 0.25], flame);
  chain([[-12.4, 0, 29.0], [-12.0, 0, 30.2], [-11.3, 0, 30.9]], [0.5, 0.4, 0.15], flame);
  chain([[-12.6, 0, 21.9], [-11.6, 0, 20.6], [-10.4, 0, 20.1]], [0.35, 0.4, 0.15], flame);
}

// ---- Ghost tail: an S of violet out of the hem, flattened to a thick ribbon, a pale streak along both faces ----
TAIL = [[0.8, 14.5], [3.6, 10.5], [4.4, 7.9], [1.5, 6.6], [-1.8, 7.5], [-4.3, 7.0], [-5.2, 4.0], [-3.6, 1.6], [-0.3, 1.2], [3.0, 2.6], [5.6, 3.3], [7.6, 2.5]];
TAIL_R = [4.0, 3.1, 2.6, 2.1, 1.7, 2.0, 2.2, 1.6, 1.3, 1.0, 0.55, 0.25];
TD = 0.6;   // depth / width
art(0) {
  scale([1, TD, 1]) chain([for (p = TAIL) [p[0], 0, p[1]]], TAIL_R, tailC);
  for (s = [-1, 1]) chain([for (i = [1 : len(TAIL) - 1]) [TAIL[i][0], s * (TD * TAIL_R[i] - 0.12), TAIL[i][1]]],
                          [for (i = [1 : len(TAIL) - 1]) max(0.15, min(0.42, TAIL_R[i] * 0.22))], streak);
  // loose wisps
  chain([[-7.0, 0, 6.4], [-7.5, 0, 7.6], [-6.7, 0, 8.6]], [0.5, 0.4, 0.15], tailC);
  chain([[-7.2, 0, 3.2], [-6.4, 0, 1.6], [-5.0, 0, 0.8]], [0.45, 0.35, 0.15], tailC);
}
