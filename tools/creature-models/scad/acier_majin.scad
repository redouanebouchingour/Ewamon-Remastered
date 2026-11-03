// Acier, Majin form: Acier's four-armed body and pose (scad/acier.scad, every joint number kept) turned to black
// volcanic stone laced with red cracks: a black helm with a tall bronze crescent horn and a short one, a red double
// visor slash, bronze horns on the upper shoulders, a red ring-core in the chest, bronze stone legs, dark feet with
// grey claws, grey knuckle studs, and the same four swords in black with red edges, red lava streaks and a red chain.
//
// Checklist (front sheet, units; the feet stand on z 4.3, the art's lowest pixel is sword D's tip):
//   head      black helm sheet x -1.7..2.5, z 20..26.8, turned to the viewer; a tall bronze crescent horn up its -X
//             side to (-1, 27.2), a short one on its +X side to (2.2, 25.1); a red double slash (-1, 22.5) -> (1.3, 24).
//   torso     black stone; the red ring core (-0.45, 17.2) r 1.7 split by a crack; a red V at the neck; red cracks.
//   shoulders bronze horns: tips (-4.1, 24.7), (-2.4, 23.8), (4, 22.9), (6.3, 24.2).
//   swords    A black with a red edge and red cloth strips; B black with a red rim, a red-wrapped grip and a red bead
//             chain; C black with red lava streaks; D black with a red groove and red edges, dark guard and grip.
//   hips      dark stone belt; legs bronze stone with red cracks; feet dark stone with three grey claws each.
//   back      the cracked black back, the four shoulders with their horns, the helm's back with the crescent horn.
include <lib.scad>

stone = [0.18, 0.17, 0.16];
stoneDk = [0.12, 0.11, 0.1];
stoneLt = [0.23, 0.23, 0.22];
bronze = [0.5, 0.34, 0.17];
bronzeDk = [0.33, 0.22, 0.12];
red = [0.89, 0.12, 0.06, NOGLOW];
crackC = [0.96, 0.22, 0.14, NOGLOW];
redDk = [0.25, 0.04, 0.03];
stud = [0.68, 0.66, 0.65];
ink = [0.06, 0.05, 0.05];

function dOf(p) = -0.5 * p[0] + 0.866 * p[1];
module flat(pts, t, c, ins = 0) {
  color(c) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(delta = -ins) polygon(pts);
}
module rod(a, b, r, c) { limb([a[0], 0, a[1]], [b[0], 0, b[1]], r, r, c); }
// a red crack ring round a limb: a thin disc whose rim shows through the limb's surface
module band(p, d, r) { color(crackC) translate(p) rotate(_dir_rot(d)) scale([1, 1, 0.13]) sphere(r, $fn = 14); }

// ---- joints (scad points, the rig copies them: rigs/acier.mjs)
H = [0.4, -2.2, 22.3];
SH2 = 5.5; SH2y = 0.5; SH2z = 20.8;
SH1 = 5.4; SH1y = -0.3; SH1z = 16.2;
E2R = [-8.78, 0, 23];   F2R = [-8.78, -1, 28.3];
E2L = [10.28, 0.8, 21.8]; F2L = [12.88, 1.5, 25.6];
E1R = [-7.16, -0.8, 11.9]; F1R = [-11.66, -2, 11.6];
E1L = [9.93, 0.8, 13.4];  W1L = [15.94, 1.6, 14.8]; F1L = [17.78, 2, 17.8];

// ---- torso
chest = [[[5.9, 3.8, 3.3], [0, 0, 18.2]], [[3.8, 3, 2.2], [0, 0.2, 14.4]]];
chestOut = [[[6.2, 4.1, 3.6], [0, 0, 18.2]], [[4.1, 3.3, 2.5], [0, 0.2, 14.4]]];
blob(chest, stone);
// red crack lines laid on the front of the chest (sheet polylines)
module crackLines(paths, w = 0.13) {
  color(crackC) intersection() {
    blob(chestOut);
    translate([0, -10, 15]) cube([24, 20, 20], center = true);
    pp(0) rotate([90, 0, 0]) linear_extrude(height = 120, center = true)
      for (p = paths) for (i = [0 : len(p) - 2]) hull() { translate(p[i]) circle(w, $fn = 6); translate(p[i + 1]) circle(w, $fn = 6); }
  }
}
crackLines([[[-1.3, 20.8], [-0.1, 19.3], [1.5, 20.8]], [[-0.1, 19.3], [-0.5, 17.8], [-0.2, 16.6], [-0.5, 15.3], [-0.2, 14.2]],
  [[-2.3, 16.8], [-3.3, 16.4], [-4.2, 17], [-5.2, 16.4]], [[-3.3, 16.4], [-3, 15.2]], [[1.4, 17.2], [3.2, 17], [4.6, 17.8]],
  [[1.2, 15.8], [2.6, 15.4], [3.4, 16.8]], [[-5, 20.1], [-3.5, 19.6], [-2.4, 20.8]], [[2.8, 20], [4.4, 20.2], [5.6, 21.2]],
  [[-4.6, 18.8], [-3.4, 18.2], [-2.4, 18.8]], [[3.6, 18.6], [4.8, 18.8], [5.8, 18.2]], [[-1.6, 14.2], [-2.8, 14.6], [-3.6, 13.8]],
  [[1.4, 14.2], [2.8, 14.4], [3.4, 13.6]]]);
crackLines([[[-1.4, 20.6], [-0.1, 19.6], [1.6, 20.6]]], 0.32);
// the red ring core, split by a crack
color(red) translate(fromSheet(-0.45, 17.2, -3.95)) rotate([0, 0, VIEW]) rotate([90, 0, 0]) scale([1, 1.08, 1])
  rotate_extrude($fn = 28) translate([1.45, 0]) circle(0.3, $fn = 8);
// cracks on the back
color(crackC) intersection() {
  union() { translate([0, 0, 19.6]) scale([5.55, 3.62, 0.14]) sphere(1, $fn = 24); translate([0, 0.1, 16.2]) scale([5.2, 3.45, 0.14]) sphere(1, $fn = 24); }
  translate([0, 10.5, 18]) cube([20, 20, 10], center = true);
}
// shoulder balls, bronze horns on the upper pair
mirror_x() {
  ell([2.45, 2.4, 2.25], [SH2, SH2y, SH2z], stone);
  ell([2.4, 2.4, 2.2], [SH1, SH1y, SH1z], stone);
  band([SH2, SH2y, SH2z], [0.6, -0.5, 1], 2.5);
  band([SH1, SH1y, SH1z], [0.5, -0.8, 0.6], 2.45);
}
spike([-5.3, 0.2, 22.4], [0.2, 0, 3], 0.62, 0.06, bronze);
spike([-3.4, -0.6, 21.6], [0.3, -0.1, 2.5], 0.55, 0.06, bronze);
spike([5, 0, 22.4], [-0.1, 0, 2.3], 0.55, 0.06, bronze);
spike([7.3, 0.3, 21.8], [0.4, 0, 2.9], 0.62, 0.06, bronze);
// neck
limb([0, -0.6, 19.2], [0.3, -1.8, 21], 1.5, 1.4, stoneDk);

// ---- head: frame = translate(H) rotate 30 (local x = sheet x + 0.75, local z = z - 22.3, -y towards the viewer)
module headF() { translate(H) rotate([0, 0, VIEW]) children(); }
headF() {
  ell([2.25, 2.1, 2.7], [0.9, 0.2, 0.4], stone);
  // a darker face plate and the red double visor slash
  translate([1, -1.55, 0.2]) rotate([0, 0, 15]) scale([1.4, 0.6, 1.7]) color(stoneDk) sphere(1, $fn = 24);
  limb([0.5, -2.2, 0.2], [2.7, -2.05, 1.7], 0.22, 0.22, red);
  limb([0.9, -2.2, -0.4], [2.6, -2.05, 0.8], 0.17, 0.17, crackC);
  ell([1, 0.9, 0.8], [1.2, -1.3, -2.2], stoneDk);
  // the tall bronze crescent horn up the -X side, and the short one on the +X side
  chain([[-0.6, -1.3, -1.6], [-0.75, -1.3, 0.6], [-0.2, -0.9, 2.6], [0, -0.4, 4.1], [-0.6, 0, 5.3]], [0.45, 0.7, 0.7, 0.45, 0.08], bronze);
  chain([[2.7, -1, 0.2], [3.1, -0.7, 1.6], [3.2, -0.4, 3.1]], [0.6, 0.45, 0.07], bronze);
}

// ---- arms: stone segments, crack rings, knuckle studs
module arm(s, e, f, r1, r2, rf) {
  limb(s, e, r1, r1 * 0.92, stone);
  ell([r1, r1, r1] * 1.02, e, stoneDk);
  limb(e, f, r2, r2 * 0.95, stone);
  ell([rf, rf, rf], f, stoneLt);
  band(s + (e - s) * 0.55, e - s, r1 * 0.97);
  band(e + (f - e) * 0.35, f - e + [0, 0.6, 0], r2 * 0.96);
  band(e + (f - e) * 0.72, f - e + [0.6, 0, 0], r2 * 0.94);
}
arm([-SH2, SH2y, SH2z], E2R, F2R, 1.95, 1.8, 1.55);
arm([SH2, SH2y, SH2z], E2L, F2L, 1.95, 1.75, 1.55);
arm([-SH1, SH1y, SH1z], E1R, F1R, 1.9, 1.65, 1.6);
limb([SH1, SH1y, SH1z], E1L, 1.9, 1.75, stone);
ell([1.85, 1.85, 1.85], E1L, stoneDk);
limb(E1L, W1L, 1.7, 1.5, stone);
limb(W1L, F1L, 1.3, 1.3, stone);
ell([1.6, 1.6, 1.6], F1L, stoneLt);
band([SH1, SH1y, SH1z] + (E1L - [SH1, SH1y, SH1z]) * 0.55, E1L - [SH1, SH1y, SH1z], 1.82);
band(E1L + (W1L - E1L) * 0.5, W1L - E1L, 1.6);
// grey knuckle studs on each fist, towards the viewer
color(stud) for (f = [F2R, F2L, F1R, F1L]) for (k = [-0.55, 0.55]) translate(f + [k * 0.5, -1.45, k]) sphere(0.38, $fn = 8);

// ---- sword A (upper -X fist): black blade, red edge, bronze grip, red cloth strips
pp(dOf(F2R)) {
  flat([[-8.42, 29.49], [-2.9, 38.9], [-1.95, 38.75], [-1.73, 38.5], [-7.43, 28.9]], 0.6, stoneDk);
  flat([[-7.43, 28.9], [-1.73, 38.5], [-1.08, 38.12], [-6.78, 28.52]], 0.6, red);
  rod([-7.7, 28.9], [-10.3, 24.8], 0.42, bronze);
  flat([[-10.6, 24.9], [-10.1, 24.9], [-10.3, 21.5], [-10.6, 20.6], [-11, 20.8], [-10.7, 22]], 0.25, red);
  flat([[-10.1, 24.6], [-9.6, 24.4], [-9, 22.8], [-9.3, 19.4], [-9.8, 19.4], [-9.6, 22.6]], 0.25, red);
}

// ---- sword B (upper +X fist): black blade with a red rim and a hooked tip, red-wrapped grip, a red bead chain
pp(dOf(F2L)) {
  bladeB = [[10.2, 26], [11.1, 27.9], [12.4, 28.4], [12.4, 30.5], [12.1, 33], [11.4, 36.5], [10.3, 38.8], [9.6, 40], [9, 39],
    [8.5, 37.5], [8.4, 33], [8.4, 28.6], [9.2, 28.2], [9.6, 26.8]];
  flat(bladeB, 0.6, red);
  flat(bladeB, 0.72, stoneDk, 0.35);
  flat([[10, 28.8], [10.9, 28.8], [10.9, 33.5], [10.4, 36.2], [9.9, 33.5]], 0.85, ink);
  rod([11.1, 28.4], [12.95, 21.3], 0.45, red);
  ell([0.55, 0.55, 0.55], [13, 0, 21], stoneLt);
  for (i = [0 : 5]) let(a = [[11.8, 36], [13.2, 35], [14.3, 32.5], [14.6, 29.5], [14.3, 26.5], [13.6, 24.5], [12.8, 23.4]])
    rod(a[i], a[i + 1], 0.36, red);
}

// ---- sword C (lower -X fist): a broad black greatsword with red lava streaks, crossbar, pommel
pp(dOf(F1R)) {
  flat([[-14.3, 13.8], [-10.1, 15.4], [-12.3, 20.8], [-14.8, 27.2], [-17.4, 28.6], [-18.1, 27.6], [-17.6, 23.5]], 1, stoneDk);
  for (pts = [[[-17.3, 27.9], [-16.4, 27.6], [-16.9, 25], [-17.3, 23.6], [-17.2, 26]],
              [[-15.6, 26.6], [-14.9, 26], [-15.3, 24.6], [-14.6, 22.8], [-15.4, 22], [-16, 24]],
              [[-16, 22.3], [-15.3, 21], [-15.6, 19.5], [-14.7, 17], [-15, 16.4], [-15.5, 18.6]],
              [[-13.8, 22], [-13.2, 20], [-13.6, 18.4], [-12.6, 16], [-13.4, 15.4], [-14.4, 18], [-14.2, 20.2]],
              [[-14.3, 17.2], [-13.8, 15.6], [-14.3, 15], [-14.7, 16.4]]])
    flat(pts, 1.15, red);
  rod([-15.1, 12.05], [-8.4, 15.2], 0.38, stoneLt);
  ell([0.55, 0.55, 0.55], [-15.1, 0, 12.05], stoneLt);
  ell([0.55, 0.55, 0.55], [-8.4, 0, 15.2], stoneLt);
  rod([-11.8, 13.7], [-9.4, 6.8], 0.42, ink);
  ell([0.65, 0.65, 0.65], [-9.4, 0, 6.8], stoneLt);
}

// ---- sword D (lower +X fist): a black slab point-down with a red groove and red edges, dark guard and grip
pp(dOf(F1L)) {
  bladeD = [[14.1, 15.5], [17.1, 15.3], [13.8, 6], [12.4, 4.4], [11.8, 6]];
  flat(bladeD, 1, red);
  flat(bladeD, 1.12, stoneDk, 0.3);
  flat([[15.3, 15], [15.9, 15], [13.1, 6.5], [12.7, 6.5]], 1.25, red);
  flat([[13.8, 17], [17.6, 16.7], [17.6, 15.2], [13.9, 15.4]], 1.6, stoneLt);
  rod([16.3, 17], [17.4, 21.2], 0.45, redDk);
  ell([0.6, 0.6, 0.6], [17.7, 0, 21.8], stoneLt);
}

// ---- hips: a dark stone belt over stone trunks, a red crack
color(stoneLt) translate([0, 0.2, 13.9]) scale([1, 0.82, 1]) cylinder(h = 1.6, r = 4.25, center = true, $fn = 32);
color(stone) translate([0, 0.2, 10]) scale([1, 0.82, 1]) cylinder(h = 3.1, r1 = 4.5, r2 = 4.1, $fn = 32);
color(crackC) translate([0, 0.2, 11.3]) scale([1, 0.82, 1]) cylinder(h = 0.22, r = 4.42, center = true, $fn = 32);

// ---- legs: bronze stone with red cracks, dark feet, three grey claws each
mirror_x() {
  limb([2.6, 0.2, 10.8], [4.9, -0.3, 8.3], 1.85, 1.6, bronze);
  ell([1.7, 1.7, 1.7], [4.9, -0.3, 8.3], bronzeDk);
  limb([4.9, -0.3, 8.3], [5.6, -0.3, 6.4], 1.6, 1.7, bronze);
  band([3.75, 0, 9.55], [2.3, -0.5, -2.5], 1.75);
  band([5.3, -0.3, 7.1], [0.7, 0, -1.9], 1.68);
  blob([[[1.85, 1.9, 1.1], [5.6, -0.2, 5.4]], [[1.4, 1.6, 0.9], [6, -1.2, 5.2]]], stoneDk);
  for (k = [-0.7, 0, 0.7]) spike([6.2 + k, -2.2 - k * 0.5, 4.95], [1.1, -1.2, -0.25], 0.5, 0.06, stud);
}
