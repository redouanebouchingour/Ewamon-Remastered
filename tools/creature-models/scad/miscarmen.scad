// Miscarmen: a wide pale-lavender ghost head pitched forward, its face low at the front: two glaring black eyes with
// yellow irises and magenta slit pupils, a wide white toothy grin under them, a rolled forelock curl on the far
// (-X) front, a white band sweeping across the brow, a crown of olive-yellow flame tufts, a ragged ghost hem under
// it, and a thin stalk of a tail streaming out to the right ending in two flat spiky starbursts marked with red.
//
// Checklist (front sheet x, z; the head's centre reads at sheet x -8.5, so S() shifts by O):
//   head      x -25..9, z 7..34, lavender; low-left face, high-right crown (pitched forward)
//   curl      x -27..-17, z 17..30, lavender roll with a white inner swirl (far front side only)
//   brow band x -22..5, z 13..25, white, from inside the curl across the forehead down the near cheek
//   eyes      near x -14..-5, far x -23..-19, z 10.5..15: black, yellow iris, magenta pupil, glare (outer corner up)
//   grin      x -21..-3, z 7.5..12.5, white teeth with grey gaps, a dark lower lip line
//   tufts     olive, 3-pointed flames: x -17..-10 z 25..30, x -9..4 z 20..30, x -15..-8 z 31..37,
//             x -5..-2 z 33..37, x -1..12 z 30..40; back shows four more round the crown's back
//   hem       lavender ragged skirt x -17..4, z 0..8, blunt lobes
//   tail      dark stalk x 3..13 z 2.5..7.7 then up-right; stars: grey-blue x 8..15 z 11..22, light blue x 15..27.5
//             z 10..26, red marks in both
// ground: -3
include <lib.scad>

lav = [0.7, 0.69, 0.86];
white = [0.97, 0.97, 1];
olive = [0.6, 0.58, 0.23];
oliveLt = [0.83, 0.84, 0.36, NOGLOW];
starLt = [0.7, 0.8, 0.95];
starDk = [0.6, 0.62, 0.76];
stalk = [0.47, 0.46, 0.57];
red = [0.82, 0.22, 0.28, NOGLOW];
ink = [0.1, 0.09, 0.11];
gap = [0.32, 0.33, 0.42];
eyeY = [0.98, 0.88, 0.1, NOGLOW];
eyeR = [0.86, 0.16, 0.42, NOGLOW];

O = 8.5;                                     // sheet x of the head's centre
function S(sx, z, y = 0) = fromSheet(sx + O, z, y);
function sh(pts) = [for (p = pts) [p[0] + O, p[1]]];   // sheet outline -> pp() frame

// ---- head: a hull of three ellipsoids (main, the high crown at the back, the low face at the front)
HA = [[14.5, 12, 11], [0, 1, 20]];
HB = [[10.5, 8, 8], [4, 7, 24]];
HC = [[12.5, 10.5, 7.5], [0, -6, 13]];
HD = [[10, 6, 4.5], [0, -8.5, 9.5]];          // the jaw carrying the grin
CURL = [[5.2, 6.5, 6.2], S(-21, 23.5, -4)];
module headBlob(g = 0) {
  hull() for (e = [HA, HB, HC, HD]) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 40);
}
module curlBlob(g = 0) {
  hull() {
    translate(CURL[1]) rotate([0, -25, -20]) scale(CURL[0] + [g, g, g]) sphere(1, $fn = 28);
    translate(S(-15, 23, -1)) sphere(7.5 + g, $fn = 24);
  }
}
module faceBlob(g = 0) { hull() for (e = [HC, HD]) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 40); }
// the half of the model in front of the picture plane (so a prism paints the front only)
module front(d = 2) { pp(0) translate([-60, -60 + d, -10]) cube([120, 60, 70]); }

color(lav) headBlob();
color(lav) curlBlob();

// white brow band: from inside the curl across the forehead and down the near cheek
BAND = [[-22.5, 24.8], [-19, 25.8], [-15, 24.4], [-11, 22.9], [-6, 22.2], [-1, 21.4], [3, 20.2], [5.2, 16.5], [4.8, 12.5],
        [2.2, 12.8], [1.4, 16], [-3, 17], [-8, 17.6], [-12, 18.6], [-16, 19.6], [-19.5, 20.4], [-21.8, 21.6]];
color(white) intersection() {
  union() { headBlob(0.3); curlBlob(0.3); }
  prism(sh(BAND));
  front();
}
// the swirl inside the curl
color(white) intersection() {
  curlBlob(0.3);
  prism(sh([[-25.5, 23], [-24, 26.5], [-21, 27.5], [-19, 26.5], [-21.5, 26], [-23.3, 24]]));
  front();
}
// white crown top between the tufts
color(white) intersection() { headBlob(0.25); translate([-30, -30, 31]) cube([60, 60, 10]); }

// ---- the grin: white teeth under the eyes, grey gaps, a dark lip line
GRIN = [[-21.6, 12.6], [-20.6, 10.4], [-18, 8.8], [-14, 7.9], [-9, 7.7], [-5.6, 8.4], [-3.4, 10], [-3.4, 12.2],
        [-6, 11.4], [-14, 11.6], [-19.4, 13]];
color(white) intersection() { faceBlob(0.3); prism(sh(GRIN)); front(); }
for (x = [-17.6, -14.6, -11.6, -8.6, -5.8])
  color(gap) intersection() { faceBlob(0.42); prism(sh([[x - 0.3, 8.6], [x + 0.3, 8.4], [x + 0.3, 10.4], [x - 0.3, 10.6]])); front(); }
color(gap) intersection() {
  faceBlob(0.42);
  prism(sh([[-20, 10], [-17.5, 8.6], [-14, 7.9], [-9, 7.7], [-5.6, 8.4], [-3.9, 9.6], [-4.6, 8.0], [-9, 7.0], [-14, 7.2],
            [-18, 8.0]]));
  front();
}

// ---- eyes: black, yellow iris, magenta slit pupil, a lavender lid slanting down to the nose (a glare)
// lib.scad eye()'s frame (looking along -Y, `flat` deep), drawn as the art's glare: a wide black almond, a yellow
// iris towards the nose, a magenta crescent at the outer corner, a black slit and a small low glint
module glareEye(p, size, yaw = 0, flat = 0.45) {
  translate(p) rotate([0, 0, yaw]) {
    color(ink) scale([1.3, flat, 0.95]) sphere(size, $fn = 22);
    color(eyeY) translate([-0.2 * size, -size * flat * 0.62, -0.1 * size]) scale([0.6, 0.5, 0.66]) sphere(size, $fn = 16);
    color(eyeR) translate([0.5 * size, -size * flat * 0.58, -0.15 * size]) scale([0.42, 0.46, 0.56]) sphere(size, $fn = 14);
    color(ink) translate([-0.12 * size, -size * (flat * 0.62 + 0.24), -0.1 * size]) scale([0.16, 0.3, 0.52]) sphere(size, $fn = 12);
    color(white) translate([0.15 * size, -size * (flat * 0.62 + 0.3), -0.35 * size]) sphere(size * 0.17, $fn = 8);
  }
}
mirror_x() glareEye([6.6, -13.8, 12.9], 3.9, yaw = 20);
// the glare: the face's own skin laid over each eye's top, its edge sloping down to the nose
mirror_x() color(lav) intersection() {
  faceBlob(0.7);
  translate([6.6, -13.8, 12.9]) rotate([0, 0, 20]) scale([1.4, 2, 1.3]) sphere(3.9, $fn = 20);
  translate([6.6, -13.8, 12.9]) rotate([0, 0, 20]) rotate([0, -16, 0]) translate([-10, -10, 0.9]) cube(20);
}

// ---- the crown of olive flame tufts, two-tone
// a flame outline (tuft frame: x across, z up), drawn as a pillow of stacked extrusions so the points stay sharp
TUFT = [[-0.42, 0], [-0.6, 0.6], [-0.3, 0.42], [-0.28, 0.9], [-0.06, 0.5], [0.06, 1], [0.2, 0.46], [0.5, 0.78],
        [0.36, 0.28], [0.42, 0]];
module pillow(pts, depth, col) {
  color(col) rotate([90, 0, 0]) for (k = [[0.3, 0.4], [-0.25, 0.75], [-0.75, 1]])
    linear_extrude(height = depth * k[1], center = true) offset(r = k[0]) polygon(pts);
}
module tuft(w, h) {
  pillow([for (p = TUFT) [p[0] * w, p[1] * h]], 2.6, olive);
  translate([-0.06 * w, 0, 0.3 * h]) pillow([for (p = TUFT) [p[0] * w * 0.55, p[1] * h * 0.62]], 3, oliveLt);
}
// [base point, facing angle (outward, degrees about Z from +X), outward tilt, width, height]
TUFTS = [
  [S(-1, 21.5, -5), -45, 22, 9, 9.5],     // big one on the near front
  [S(-14, 25, -9), -115, 24, 6.5, 6.5],   // front left, over the curl
  [S(-10.5, 30, -1), -160, 20, 6.5, 7.5], // far side, top
  [S(-3.5, 31.5, 3), 150, 14, 4.5, 6],    // small, top middle
  [S(4.5, 30.5, 2), 15, 14, 10, 10],      // big, top right
  [[3, 11, 27.5], 85, 22, 8, 9],          // back
  [[-7, 7, 28], 130, 24, 7, 9],           // back, far side
  [[10, 4, 27], 40, 26, 6, 7.5],          // near side, behind the big one
];
for (t = TUFTS) translate(t[0]) rotate([0, 0, t[1] + 90]) rotate([t[2], 0, 0]) translate([0, 0, -1.5]) tuft(t[3] * 1.4, t[4] * 1.25);

// ---- the ragged ghost hem under the head
HEM = [1, 2.5];
color(lav) hull() {
  translate([1, 1, 11]) scale([10, 9, 4]) sphere(1, $fn = 32);
  translate([HEM[0], HEM[1], 5.5]) scale([8.5, 7.5, 2.5]) sphere(1, $fn = 28);
}
// blunt lobes: [angle, tip z]
LOBES = [[-30, 0], [-78, 1], [-125, 2], [-170, 3], [125, 2.5], [70, 1.5], [15, 2]];
for (l = LOBES) color(lav) hull() {
  translate([HEM[0] + 5.8 * cos(l[0]), HEM[1] + 5.2 * sin(l[0]), 5.5]) scale([3.2, 3.2, 1.8]) sphere(1, $fn = 14);
  translate([HEM[0] + 7 * cos(l[0]), HEM[1] + 6.4 * sin(l[0]), l[1] + 1.4]) scale([1.6, 1.6, 1.4]) sphere(1, $fn = 12);
}

// ---- tail: a thin stalk streaming out right, two flat spiky stars (pillows facing the view)
TAIL = [[0, 4, 6], [5, 3, 4.6], [10, 3, 5], [14, 3.5, 8.5], [17, 3, 12]];   // [sheet x, depth, z]
TAIL_R = [1.4, 1.1, 0.95, 0.85, 0.8];
pp(0) translate([O, 0, 0]) {
  chain(TAIL, TAIL_R, stalk);
  chain([[10, 3, 5], [11.2, 4.5, 8.5], [11.8, 5, 12]], [0.95, 0.8, 0.7], stalk);
}
function starPts(c, ro, ri, n, a0) = [for (i = [0 : 2 * n - 1])
  let(a = a0 + i * 180 / n, r = i % 2 == 0 ? ro : ri) [c[0] + r * cos(a), c[1] + r * sin(a)]];
// a spiky star pillow: stacked extrusions (not a hull, which would fill the notches), thickest in the middle
module star(c, ro, ri, n, a0, d, col, depth) {
  pp(d) color(col) rotate([90, 0, 0]) for (k = [[0.25, 0.45], [-0.45, 0.75], [-1.1, 1]])
    linear_extrude(height = depth * k[1], center = true) offset(r = k[0])
      polygon(sh(starPts(c, ro, ri, n, a0)));
}
star([12, 16.8], 5.6, 2.6, 7, 100, 5, starDk, 2.8);
star([20.6, 17.3], 7, 3, 7, 75, 2.5, starLt, 3.2);
// red marks, through both faces (the back art shows them too)
pp(2.5) plate(sh([[19.3, 15.6], [20.3, 15.6], [20.7, 18], [21.6, 18], [21.6, 20.6], [20.6, 20.6], [20.2, 18.6],
                  [19.3, 18.6]]), t = 3.6, r = 0.15, c = red, grow = 0.1);
pp(5) plate(sh([[12.4, 17.6], [13.4, 17.6], [13.4, 19.4], [14.2, 19.4], [14.2, 20.6], [12.4, 20.6]]), t = 3.2, r = 0.15,
             c = red, grow = 0.1);
