// Kygra: a hunched blue penguin-knight (sheet: 36 x 40, feet on z = 0).
// Checklist (front sheet, x = sheet x):
//   FACE: a big helm head x -11..+9, z 18.5..31, turned to the viewer's left. A gold trident over the face: a beak
//     point at the bottom (-7.6, 18.4), a U round the chin, three prongs up the face (far -10.5 to z 29.8, centre -7
//     to z 31.8, near -2.5 to z 29). Light blue face plates between the prongs. One small white eye with a dark lid
//     at (-3.3, 21.9), just past the near prong's foot (the far eye mirrored, hidden behind the far prong).
//   The head's back sweeps up and right into a wedge to (9, 30.5); its underside is the diagonal (0.5, 21.4)..(9, 30).
//   Crown: five flat plumes standing straight up on the head top, forked tips: x -9.2..-5.5 (to z 39.5), -5.5..-0.5
//     (39.4), a short one -1.6..1.1 (35), 1.7..5.5 (38.4), 5.5..9.9 (38.4). Lighter blue.
//   Torso hidden behind the blades: a grey bib x -5..1.2, z 12..19.9 with white feathers.
//   Blades (the arms are flipper swords): viewer's left one from the chest down to a point at (-17.9, 6.4), dark
//     navy with a light rim on its upper edge and a pale tip; viewer's right one out to (18.3, 24.9), navy with a
//     lighter lower rim.
//   Legs: thin bird legs in a wide stance. Viewer's left: thigh forward to a knee (-8, 11.6), shin back to (-5, 6.4),
//     a raised foot with two white talons pointing left. Viewer's right: thigh down to (2.5, 9.6), shin to (5.4, 4.2),
//     the foot on the ground with two white talons splayed both ways.
//   Back art: the blades spread wide like wings, light blue streaks over the shoulders.
include <lib.scad>

blue = [0.23, 0.39, 0.71];
blueDk = [0.17, 0.33, 0.58];
faceB = [0.3, 0.52, 0.85, NOGLOW];
plumeB = [0.28, 0.47, 0.8, NOGLOW];
navy = [0.07, 0.13, 0.26];
navy2 = [0.07, 0.22, 0.44];
rim = [0.3, 0.52, 0.85, NOGLOW];
pale = [0.61, 0.81, 0.99, NOGLOW];
gold = [0.95, 0.83, 0.45, NOGLOW];
grey = [0.7, 0.68, 0.63];
white = [0.96, 0.96, 0.94];
footDk = [0.2, 0.24, 0.44];
ink = [0.06, 0.06, 0.07];

// Scad point for sheet (sx, z) at picture-plane depth d (+ = away from the viewer).
function P(sx, z, d) = [sx * cos(VIEW) - d * sin(VIEW), sx * sin(VIEW) + d * cos(VIEW), z];
// Sheet-coordinate children stood in a vertical plane turned `ang` about Z through P(sx0, 0, d), stretched so the
// outline still reads 1:1 on the front sheet.
module sp(ang, sx0, d) {
  translate(P(sx0, 0, d)) rotate([0, 0, ang]) scale([1 / cos(ang - VIEW), 1, 1]) translate([-sx0, 0, 0]) children();
}
// Everything nearer the viewer than picture-plane depth d (for markings on the front of a part only).
module nearer(d) { pp(0) translate([-60, -60, -10]) cube([120, 60 + d, 70]); }
// Flat blade: a rim-coloured pillow of the outline with a thicker core panel inset by `ins`.
module bladeSlab(pts, c, core, ins = 1.1) {
  slab(pts, 1.5, c, inset = 0.6);
  color(core) rotate([90, 0, 0]) linear_extrude(height = 1.95, center = true) offset(r = -ins) polygon(pts);
}

// ---- Head: the face (front, a little turned towards the viewer), the skull and the swept crest wedge.
FACE = [P(-6.6, 25.2, -2.5), 25];   // centre, yaw
// The face in its own frame (x across, -y forward): a shield, broad at the brow, narrowing to the beak.
FACE_ELLS = [[[5.2, 3, 2.6], [0, 0, 2.6]], [[4.8, 3, 2.6], [0, -0.2, 0]], [[3.2, 2.6, 2], [0, -0.6, -3.4]], [[1.4, 1.6, 1.2], [0, -1.6, -5.4]]];
SKULL = [P(-3, 26.5, 0), [4.5, 4.4, 4.6]];
CREST = [[P(3, 28.4, 2), [3, 3.4, 2.6]], [P(7.6, 29.4, 3), [2.2, 1.6, 1.4]]];
module face(g = 0) {
  color(blue) translate(FACE[0]) rotate([0, 0, FACE[1]]) hull() for (e = FACE_ELLS) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 28);
}
module skull(g = 0) {
  color(blue) hull() {
    translate(SKULL[0]) scale(SKULL[1] + [g, g, g]) sphere(1, $fn = 32);
    for (c = CREST) translate(c[0]) scale(c[1] + [g, g, g]) sphere(1, $fn = 20);
  }
}
face();
skull();
// Gold trident laid on the front of the face and skull: beak point, the U round the chin, three prongs.
trident = [[-7.6, 18.3], [-9.4, 19.5], [-10.7, 21.2], [-10.7, 28.4], [-9.8, 29.9], [-9, 28.2], [-9.1, 26.8], [-9.1, 22.2],
           [-8.4, 22.6], [-7.7, 24.4], [-7.2, 26.2], [-7.6, 29], [-6, 31.9], [-4.6, 30.6], [-4.3, 29.3], [-6, 27.4],
           [-6.5, 24.5], [-6.4, 21.9], [-5.4, 21.6], [-4.3, 22.4], [-3.8, 24.6], [-3.3, 26.8], [-2.4, 28.7], [-1, 29.2],
           [-1.7, 27.7], [-2.2, 26.2], [-2.7, 23.6], [-3.4, 22.5], [-4.6, 21], [-6, 20.4], [-6.6, 19.2]];
color(gold) intersection() {
  union() { face(0.35); skull(0.35); }
  prism(trident);
  nearer(-1.2);
}
// Light blue face plates between the prongs.
for (m = [[[-9.1, 22.2], [-9.1, 26.8], [-9, 28.2], [-8.4, 29.6], [-7.6, 29], [-7.2, 26.2], [-7.7, 24.4], [-8.4, 22.6]],
          [[-6.4, 21.9], [-6.5, 24.5], [-6, 27.4], [-4.3, 29.3], [-3.6, 28], [-3.3, 26.8], [-3.8, 24.6], [-4.3, 22.4], [-5.4, 21.6]]])
  color(faceB) intersection() {
    union() { face(0.2); skull(0.2); }
    prism(m);
    nearer(-1.2);
  }
// The beak point under the trident's U.
color(gold) hull() {
  translate(P(-7.2, 21, -4.6)) scale([1.1, 0.9, 0.8]) sphere(1, $fn = 14);
  translate(P(-7.6, 18.7, -4.2)) sphere(0.35, $fn = 8);
}
// Eyes: small, white, glaring from under a dark brow, low on the sides of the face just past the side prongs.
FACE_EYE = [3.6, -1.3, -3.1];
translate(FACE[0]) rotate([0, 0, FACE[1]]) mirror_x()
  translate(FACE_EYE) rotate([-10, 0, 0])
    eye([0, 0, 0], 0.85, iris = white, pupil = ink, slit = 0.8, sclera = white, yaw = 35, lid = 0.32, lid_tilt = 22, lid_c = blueDk,
        squint = 0.12, shine = true);

// ---- Crown: five flat plumes with forked tips, standing in the picture plane at rising depth.
module plume(x, z0, z1, w, d, fork = true) {
  h = z1 - z0;
  pp(d) if (fork) {
    // the shaft, then two tines with a V notch between them (slab() is convex, so each piece is its own)
    slab([[x - w / 2, z0], [x + w / 2, z0], [x + w / 2 + 0.1, z1 - 2.2], [x - w / 2 - 0.1, z1 - 2.2]], 1.7, plumeB, inset = 0.7);
    slab([[x - w / 2 - 0.1, z1 - 2.8], [x - 0.4, z1 - 2.8], [x - 0.8, z1], [x - w / 2 + 0.1, z1]], 1.5, plumeB, inset = 0.5);
    slab([[x + 0.4, z1 - 2.8], [x + w / 2 + 0.1, z1 - 2.8], [x + w / 2 - 0.1, z1], [x + 0.8, z1]], 1.5, plumeB, inset = 0.5);
  } else slab([[x - w / 2, z0], [x + w / 2, z0], [x + w * 0.3, z1 - 1.2], [x, z1], [x - w * 0.3, z1 - 1.2]], 1.7, plumeB, inset = 0.7);
}
plume(-7.4, 28, 39.4, 3.1, -1.5);
plume(-2.9, 29, 39.3, 3.4, 0);
plume(-0.3, 29, 35, 2.3, 1, false);
plume(3.6, 28.5, 38.3, 3.3, 2);
plume(7.7, 28, 38.3, 3.5, 3);

// ---- Torso: hunched, mostly hidden behind the blades; a grey bib with white feathers on the chest.
TORSO = [[[4, 3.6, 4.4], [-1.2, 0.6, 16.2]], [[3.6, 3.2, 2.8], [-1.6, -0.6, 19.4]]];
blob(TORSO, blue);
chest = [[-5, 18.8], [-2.8, 19.9], [-0.3, 19.9], [1.2, 17], [0.7, 12], [-1.2, 12], [-3, 14], [-5, 16.3]];
color(grey) intersection() {
  blob([for (e = TORSO) [e[0] + [0.3, 0.3, 0.3], e[1]]], grey);
  prism(chest);
  nearer(0.5);
}
for (m = [[[-4.5, 16.8], [-2.8, 16.5], [-3.1, 14.9], [-4.3, 15.4]], [[-2.3, 16], [-0.1, 15.7], [-0.3, 13.6], [-1.5, 14.1]]])
  color(white) intersection() {
    blob([for (e = TORSO) [e[0] + [0.45, 0.45, 0.45], e[1]]], white);
    prism(m);
    nearer(0.5);
  }
// Neck under the helm.
limb([-1.6, -0.6, 20], P(-4.2, 23, -1.5), 2.4, 2.2, blue);
// Light blue feather streaks hanging over the upper back (the back art).
for (i = [-1 : 2]) petal([1, 0.35, 3], [-1.2 + i * 2.3, 3.8 - abs(i - 0.5) * 0.3, 18.6], [14, i * 6 - 3, 0], faceB);

// ---- Arms: short shoulders into the flipper blades.
SHL = [3, 0.6, 20.4];
SHR = [-5.4, 0.6, 20.4];
ell([1.8, 1.8, 1.6], SHL, blue);
ell([1.4, 1.5, 1.4], SHR, blue);
limb(SHL, P(3.2, 18.2, 0.6), 1.5, 1.4, blue);
limb(SHR, P(-5.2, 17, 3), 1.5, 1.4, blue);
// Viewer's right blade: out to the right and a little back, like a spread wing.
bladeL = [[2.4, 19.8], [4.6, 21.6], [6.4, 22.2], [7.6, 23.8], [10, 23.4], [12, 24], [15, 24.4], [18.3, 24.9], [18.3, 22.4],
          [16.2, 19.6], [14, 16.4], [13.2, 13.2], [10.6, 12.5], [8.6, 13.1], [5, 13.1], [3.3, 15.8]];
sp(10, 3, 0.6) {
  bladeSlab(bladeL, blueDk, navy2);
  // the light cutting edge down its outer side
  color(rim) rotate([90, 0, 0]) linear_extrude(height = 1.75, center = true)
    polygon([[18.7, 25.2], [18.7, 22.3], [16.5, 19.4], [14.4, 16.3], [13.6, 12.9], [12.3, 13.4], [12.8, 16.4], [15, 19.8], [17, 23.2], [17.1, 25]]);
  // the pale patch on its lower rim
  color(pale) rotate([90, 0, 0]) linear_extrude(height = 1.7, center = true)
    polygon([[10.6, 12.5], [13.2, 13.2], [13.6, 16], [11.4, 16.4], [10, 14.4]]);
}
// Viewer's left blade: swept down and forward to a point, the cutting edge on top.
bladeR = [[-17.9, 6.3], [-13.6, 6.3], [-11.4, 7.6], [-9, 9.4], [-8.4, 11.6], [-6.8, 13.8], [-4.8, 15.2], [-4.8, 18.6],
          [-7.8, 18.8], [-10, 20.4], [-11.3, 19.6], [-15.4, 13.8], [-17.9, 10]];
sp(20, -5, 3) {
  bladeSlab(bladeR, blueDk, navy, ins = 1.2);
  color(rim) rotate([90, 0, 0]) linear_extrude(height = 1.75, center = true)
    polygon([[-18.3, 10], [-15.7, 14], [-11.5, 20], [-10, 20.8], [-9.5, 19.3], [-11.1, 17.6], [-14.5, 12.6], [-16.5, 8.8]]);
  color(pale) rotate([90, 0, 0]) linear_extrude(height = 1.7, center = true)
    polygon([[-17.9, 6.3], [-16.2, 6.3], [-16.6, 9], [-15.6, 12.6], [-16.4, 12.8], [-17.9, 10]]);
}

// ---- Legs: thighs, long shins, dark feet and white talons.
HIPR = fromSheet(-3.2, 14.2, 0.5);  KNEER = fromSheet(-8, 11.6, -3);  ANKR = fromSheet(-5, 6.4, 0);  FOOTR = fromSheet(-6.2, 5, -1);
HIPL = fromSheet(1.6, 15, 0.5);     KNEEL = fromSheet(2.5, 9.6, -1.5); ANKL = fromSheet(5.4, 4.2, 0.5); FOOTL = fromSheet(5.3, 2.2, 0);
chain([HIPR, KNEER, ANKR, FOOTR], [2.1, 1.4, 0.95, 0.9], blue);
chain([HIPL, KNEEL, ANKL, FOOTL], [2.1, 1.4, 0.95, 0.9], blue);
ell([1.2, 1.2, 0.9], FOOTR, footDk);
ell([1.3, 1.3, 1], FOOTL, footDk);
// toe from the foot to a point: dark at the root, a white talon on the end
module toe(f, tip, r) {
  m = f + (tip - f) * 0.3;
  limb(f, m, r, r * 0.9, footDk);
  spike(m, tip - m, r * 0.95, 0.12, white);
}
toe(FOOTR, fromSheet(-9.9, 4.6, -4), 0.75);
toe(FOOTR, fromSheet(-8.6, 2.3, -2.5), 0.75);
toe(FOOTR, fromSheet(-4.6, 4.2, 2), 0.45);
toe(FOOTL, fromSheet(2, 0.4, -3), 0.8);
toe(FOOTL, fromSheet(8.5, 0.4, 2.5), 0.8);
toe(FOOTL, fromSheet(5.8, 0.3, -3.5), 0.55);
