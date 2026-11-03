// Acier: a four-armed iron warrior of riveted grey plate, a small black helm turned to the viewer with a gold
// half-mask round a black face void, black chest plates, a gold belt over grey trunks, gold greaves, brown boots with
// white toes, and one different sword in each fist (the 2026-11-03 sprite).
//
// Checklist (front sheet, units; the art's lowest pixel is sword D's tip, the feet stand on z 4.3, which is the
// model's floor, so compare with --ground 4.3):
//   head      sheet x -3..3, z 19.5..26.7, turned to face the viewer (rz 30). Black skull, a slanted black block on top
//             (x -1..3, z 23..26.7), a deep black face void (x -1..1.5, z 20.4..23.2), a gold crescent mask with a white
//             rim on its -X side and a gold V at the chin.
//   torso     grey, x -5..6, z 13..22; two black chest plates (x -5..-0.5 and 0.6..6.4, z 15.6..20.2), gold straps
//             down the sternum. Four shoulder balls: upper at z 21, lower at z 16.
//   arm2R     (-X, raised) shoulder -> elbow (-6.6, 22.6) -> fist (-8.1, 28.3): sword A, a cleaver (black spine, silver
//             edge) up to (-1.9, 38.6), a white wrapped grip down to (-10.3, 24.8) with two cloth strips to z 19.
//   arm2L     (+X, raised) shoulder -> elbow (9.3, 21.8) -> fist (11.9, 25.6): sword B, a silver blade with a black
//             core and a hooked tip at (9.6, 40), a red-wrapped grip down to (13, 21), a dark chain looping out to x 14.6.
//   armR      (-X, low) shoulder -> elbow (-6.8, 12.6) -> fist (-11.1, 11.6): sword C, a broad black greatsword with
//             pale crackle up-left to (-17.4, 28.6), a long crossbar, a pommel at (-9.4, 6.8).
//   armL      (+X, low) shoulder -> elbow (9, 14.2) -> wrist (14.6, 15.6) -> fist (16.4, 17.8): sword D, a grey slab
//             point-down to the ground at (12.4, 4.4), a block guard, a brown grip up to the pommel (17.7, 21.8).
//   hips      black waistband z 14.3, gold belt z 13.4, grey trunks z 10..13.
//   legs      gold thighs and shins, dark-gold knee bands, brown boots (z 4.3..6.5), white toes splayed outwards.
//   back      the riveted grey back, the four shoulders, the helm's back, the belt; the swords as in front.
// The swords are flat parts traced from the sheet in pp(d), d = the depth of their fist.
include <lib.scad>

grey = [0.54, 0.54, 0.6];
greyDk = [0.41, 0.4, 0.46];
black = [0.17, 0.17, 0.17];
voidC = [0.04, 0.04, 0.05];
ink = [0.1, 0.09, 0.1];
gold = [0.9, 0.72, 0.25, NOGLOW];
goldDk = [0.64, 0.5, 0.17];
boot = [0.36, 0.26, 0.13];
white = [0.94, 0.94, 0.93, NOGLOW];
silver = [0.71, 0.71, 0.74];
iron = [0.63, 0.63, 0.66];
cloth = [0.81, 0.81, 0.81];
red = [0.78, 0.12, 0.12, NOGLOW];

// depth of a scad point behind the picture plane (pp(d) puts sheet-traced parts at that depth)
function dOf(p) = -0.5 * p[0] + 0.866 * p[1];
// a flat part from a sheet outline, t thick (inside pp())
module flat(pts, t, c) { color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) polygon(pts); }
// a rod between two sheet points (inside pp())
module rod(a, b, r, c) { limb([a[0], 0, a[1]], [b[0], 0, b[1]], r, r, c); }

// ---- joints (scad points, the rig copies them)
H = [0.4, -2.2, 22.3];                    // head centre, forward of the chest (turned 30 degrees to the viewer)
SH2 = 5.5; SH2y = 0.5; SH2z = 20.8;         // upper shoulders
SH1 = 5.4; SH1y = -0.3; SH1z = 16.2;      // lower shoulders
E2R = [-8.78, 0, 23];   F2R = [-8.78, -1, 28.3];     // arm2R elbow, fist (sword A)
E2L = [10.28, 0.8, 21.8]; F2L = [12.88, 1.5, 25.6];    // arm2L elbow, fist (sword B)
E1R = [-7.16, -0.8, 11.9]; F1R = [-11.66, -2, 11.6];   // armR elbow, fist (sword C)
E1L = [9.93, 0.8, 13.4];  W1L = [15.94, 1.6, 14.8]; F1L = [17.78, 2, 17.8];  // armL elbow, wrist, fist (sword D)

// ---- torso
chest = [[[5.9, 3.8, 3.3], [0, 0, 18.2]], [[3.8, 3, 2.2], [0, 0.2, 14.4]]];
chestOut = [[[6.25, 4.15, 3.65], [0, 0, 18.2]], [[4.15, 3.35, 2.55], [0, 0.2, 14.4]]];
blob(chest, grey);
// markings laid on the front of the chest
module chestFront(pts, c) {
  color(c) intersection() { blob(chestOut); translate([0, -10, 15]) cube([24, 20, 20], center = true); prism(pts); }
}
chestFront([[-5.2, 19.6], [-3.4, 20.2], [-1.2, 19.4], [-0.4, 17.2], [-1, 16], [-2.8, 15.6], [-4.6, 16.2], [-5.4, 17.6]], black);
chestFront([[0.8, 19.8], [2.4, 20.8], [4.8, 20.6], [6.4, 19.6], [6.3, 17.2], [4.6, 15.9], [2, 15.8], [0.6, 16.8]], black);
chestFront([[-1, 19.6], [-0.6, 19.5], [-1.2, 17], [-1.6, 17.1]], gold);
chestFront([[0.5, 19.9], [0.9, 19.9], [1, 17.2], [0.6, 17.2]], gold);
// rivets on the back plates
color(greyDk) for (p = [[-2.5, 3.5, 19.5], [2.5, 3.5, 19.5], [-2, 3.3, 16.5], [2, 3.3, 16.5], [0, 3.85, 18]]) translate(p) sphere(0.35, $fn = 8);
// shoulder balls
mirror_x() {
  ell([2.45, 2.4, 2.25], [SH2, SH2y, SH2z], grey);
  ell([2.4, 2.4, 2.2], [SH1, SH1y, SH1z], grey);
  color(greyDk) translate([SH2 + 0.6, SH2y - 2.3, SH2z + 0.8]) sphere(0.35, $fn = 8);
  color(greyDk) translate([SH1 + 0.6, SH1y - 2.2, SH1z + 0.6]) sphere(0.35, $fn = 8);
}
// neck
limb([0, -0.6, 19.2], [0.3, -1.8, 21], 1.5, 1.4, greyDk);

// ---- head: frame = translate(H) rotate 30 (local x = sheet x + 0.75, local z = z - 22.3, -y towards the viewer)
module headF() { translate(H) rotate([0, 0, VIEW]) children(); }
headF() {
  ell([2.3, 2.2, 2.6], [0, 0.2, 0], black);
  // the slanted block on top of the helm
  color(black) hull() for (p = [[-0.2, 0.3, 4.55], [1.65, 0.3, 4.55], [3.6, 0.4, 3.3], [2.8, 0.4, 1], [0.2, 0.2, 1.8]])
    translate(p) cube([0.4, 2.6, 0.3], center = true);
  // the black face void, on the +X half of the helm
  translate([1, -1.6, -0.2]) rotate([0, 0, 20]) scale([1.15, 0.6, 1.4]) color(voidC) sphere(1, $fn = 28);
  // the grey jaw plate under it
  ell([1, 0.9, 0.8], [0.85, -1.3, -2.3], greyDk);
}
// the gold half-mask and its white rim, laid on the front of the helm
module helmShell(g) {
  headF() intersection() { ell([2.3 + g, 2.2 + g, 2.6 + g], [0, 0.2, 0]); translate([0, -5, 0]) cube([10, 10, 10], center = true); }
}
color(gold) intersection() {
  helmShell(0.3);
  prism([[-3, 23.6], [-1.9, 23.9], [-1, 24.6], [-0.5, 24.2], [-0.2, 23.6], [-0.8, 23], [-1.15, 21.4], [-0.85, 20.4], [-0.4, 20],
    [0.6, 20.5], [1.2, 21.2], [1.4, 20.6], [0.8, 19.8], [-0.4, 19.3], [-1.2, 19.6], [-2.2, 21]]);
}
color(gold) intersection() { helmShell(0.3); prism([[0.6, 23.3], [1.5, 22.8], [1.6, 22.4], [0.8, 22.8]]); }
color(white) intersection() { helmShell(0.36); prism([[-3.05, 23.6], [-2.6, 23.7], [-1.7, 21], [-0.9, 19.6], [-1.3, 19.5], [-2.3, 20.9]]); }

// ---- arms (segmented plates: limb, a darker elbow ball, limb, fist)
module arm(s, e, f, r1, r2, rf) {
  limb(s, e, r1, r1 * 0.92, grey);
  ell([r1, r1, r1] * 1.02, e, greyDk);
  limb(e, f, r2, r2 * 0.95, grey);
  ell([rf, rf, rf], f, grey);
}
arm([-SH2, SH2y, SH2z], E2R, F2R, 1.95, 1.8, 1.55);
arm([SH2, SH2y, SH2z], E2L, F2L, 1.95, 1.75, 1.55);
arm([-SH1, SH1y, SH1z], E1R, F1R, 1.9, 1.65, 1.6);
limb([SH1, SH1y, SH1z], E1L, 1.9, 1.75, grey);
ell([1.85, 1.85, 1.85], E1L, greyDk);
limb(E1L, W1L, 1.7, 1.5, grey);
limb(W1L, F1L, 1.3, 1.3, grey);
ell([1.6, 1.6, 1.6], F1L, grey);

// ---- sword A (upper -X fist): a cleaver, black spine up-left, silver edge, white grip and two cloth strips
pp(dOf(F2R)) {
  flat([[-8.42, 29.49], [-2.9, 38.9], [-1.95, 38.75], [-1.73, 38.5], [-7.43, 28.9]], 0.6, black);
  flat([[-7.43, 28.9], [-1.73, 38.5], [-1.08, 38.12], [-6.78, 28.52]], 0.6, silver);
  rod([-7.7, 28.9], [-10.3, 24.8], 0.42, cloth);
  flat([[-10.6, 24.9], [-10.1, 24.9], [-10.3, 21.5], [-10.6, 20.6], [-11, 20.8], [-10.7, 22]], 0.25, white);
  flat([[-10.1, 24.6], [-9.6, 24.4], [-9, 22.8], [-9.3, 19.4], [-9.8, 19.4], [-9.6, 22.6]], 0.25, white);
}

// ---- sword B (upper +X fist): silver blade with a black core and a hooked tip, red grip, a chain
pp(dOf(F2L)) {
  flat([[10.2, 26], [11.1, 27.9], [12.4, 28.4], [12.4, 30.5], [12.1, 33], [11.4, 36.5], [10.3, 38.8], [9.6, 40], [9, 39],
    [8.5, 37.5], [8.4, 33], [8.4, 28.6], [9.2, 28.2], [9.6, 26.8]], 0.6, silver);
  flat([[10, 28.8], [10.9, 28.8], [10.9, 33.5], [10.4, 36.2], [9.9, 33.5]], 0.75, ink);
  rod([11.1, 28.4], [12.95, 21.3], 0.45, red);
  ell([0.55, 0.55, 0.55], [13, 0, 21], greyDk);
  color(ink) for (i = [0 : 6]) let(a = [[11.8, 36], [13.2, 35], [14.3, 32.5], [14.6, 29.5], [14.3, 26.5], [13.6, 24.5], [12.8, 23.4]])
    if (i < 6) rod(a[i], a[i + 1], 0.34, ink);
}

// ---- sword C (lower -X fist): a broad black greatsword with pale crackle, crossbar, pommel
pp(dOf(F1R)) {
  flat([[-14.3, 13.8], [-10.1, 15.4], [-12.3, 20.8], [-14.8, 27.2], [-17.4, 28.6], [-18.1, 27.6], [-17.6, 23.5]], 1, black);
  for (pts = [[[-17.3, 27.9], [-16.4, 27.6], [-16.9, 25], [-17.3, 23.6], [-17.2, 26]],
              [[-15.6, 26.6], [-14.9, 26], [-15.3, 24.6], [-14.6, 22.8], [-15.4, 22], [-16, 24]],
              [[-16, 22.3], [-15.3, 21], [-15.6, 19.5], [-14.7, 17], [-15, 16.4], [-15.5, 18.6]],
              [[-13.8, 22], [-13.2, 20], [-13.6, 18.4], [-12.6, 16], [-13.4, 15.4], [-14.4, 18], [-14.2, 20.2]],
              [[-14.3, 17.2], [-13.8, 15.6], [-14.3, 15], [-14.7, 16.4]]])
    flat(pts, 1.15, silver);
  rod([-15.1, 12.05], [-8.4, 15.2], 0.38, greyDk);
  ell([0.55, 0.55, 0.55], [-15.1, 0, 12.05], greyDk);
  ell([0.55, 0.55, 0.55], [-8.4, 0, 15.2], greyDk);
  rod([-11.8, 13.7], [-9.4, 6.8], 0.42, ink);
  ell([0.65, 0.65, 0.65], [-9.4, 0, 6.8], greyDk);
}

// ---- sword D (lower +X fist): a grey slab point-down to the ground, a dark groove, a block guard, a brown grip
pp(dOf(F1L)) {
  flat([[14.1, 15.5], [17.1, 15.3], [13.8, 6], [12.4, 4.4], [11.8, 6]], 1, iron);
  flat([[15.3, 15], [15.9, 15], [13.1, 6.5], [12.7, 6.5]], 1.15, greyDk);
  flat([[13.8, 17], [17.6, 16.7], [17.6, 15.2], [13.9, 15.4]], 1.6, silver);
  rod([16.3, 17], [17.4, 21.2], 0.45, boot);
  ell([0.6, 0.6, 0.6], [17.7, 0, 21.8], silver);
}

// ---- hips: black waistband, gold belt, grey trunks
color(black) translate([0, 0.2, 14.3]) scale([1, 0.82, 1]) cylinder(h = 0.9, r = 4.2, center = true, $fn = 32);
color(gold) translate([0, 0.2, 13.5]) scale([1, 0.82, 1]) cylinder(h = 0.8, r = 4.15, center = true, $fn = 32);
color(grey) translate([0, 0.2, 10]) scale([1, 0.82, 1]) cylinder(h = 3.1, r1 = 4.5, r2 = 4.1, $fn = 32);
color(greyDk) translate([0, 0.2, 10.2]) scale([1, 0.82, 1]) cylinder(h = 0.5, r = 4.55, center = true, $fn = 32);

// ---- legs: gold greaves, dark-gold bands, brown boots, white toes splayed outwards
mirror_x() {
  limb([2.6, 0.2, 10.8], [4.9, -0.3, 8.3], 1.8, 1.55, gold);
  ell([1.65, 1.65, 0.65], [4.9, -0.3, 8.3], goldDk);
  limb([4.9, -0.3, 8.3], [5.6, -0.3, 6.4], 1.55, 1.65, gold);
  ell([1.7, 1.7, 0.45], [5.3, -0.3, 7.1], goldDk);
  blob([[[1.85, 1.9, 1.1], [5.6, -0.2, 5.4]], [[1.4, 1.6, 0.9], [6, -1.2, 5.2]]], boot);
  for (k = [-0.5, 0.5]) spike([6.2 + k, -2.2 - k * 0.5, 4.95], [1.1, -1.2, -0.25], 0.55, 0.08, white);
}
