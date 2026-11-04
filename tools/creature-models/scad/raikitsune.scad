// Raikitsune: an orange thunder fox crouched in a fighting stance, nine big bushy black-tipped tails fanned in a ring
// behind it, a cyan scarf round the neck streaming two ribbons to its left (the viewer's right), a crackling blue orb
// held out in its right paw, black socks to the thighs, silver claws and a silver spiked bracer on the left forearm.
//
// Checklist (front sheet, 40 units tall, x = sheet x):
// - Tails: nine, from the rump (sheet 1.75, 11.5), tips at (-23, 13.5) (-22.7, 29) (-19, 36) (-10.5, 39) (5, 40)
//   (20, 34) (22.7, 26) (22.7, 11) and one cream-tipped tail curling down to (13, 4.5). Each broad (6 to 7 wide),
//   orange with a lighter centre streak and a black (teal-sheened) tip over its last quarter. Built in the picture
//   plane (pp) so the fan is face-on from the front and the back, as drawn; given depth (0.7 of the width).
// - Head z 24..31, turned to the viewer's left: snout tip at (-5.3, 27), black nose, cream lower muzzle and cheeks,
//   a mouth line, fierce slanted cyan eyes (outer corner up) under an orange scowl, black rim. Ears tall and
//   splayed (tips at about (-4.5, 36.5) and (3, 37)), black tips, pale inner.
// - Scarf: a broad cyan wrap at z 20..25, a short flap to the left, two ribbons streaming right to x 12 (upper,
//   curling up to z 30) and x 18 (lower, z 19..23). Cyan medallion with a swirl on the chest at (-1.8, 19.5).
// - Torso: small, crouched, z 9..23; cream belly strip x -4..-0.5 on the sheet.
// - Right arm (-X, viewer's left): out to the side, black forearm, paw cradling the orb at (-14.5, 19.5), r 2.8,
//   lightning crackling round it. Left arm (+X): hangs, black forearm with a silver spiked bracer (spike tip at
//   (6.5, 20)), paw at about (6, 10).
// - Legs: crouched wide stance, orange hips, black from mid-thigh down, feet at (-8, 1) and (7.5, 1.5) pointing out,
//   white claws, small steel greaves.
// - Lightning: pale zigzags on the tails' fronts, bright cyan ones wrapping the tails on the back.
include <lib.scad>

fur     = [0.88, 0.38, 0.06, NOGLOW];
cream   = [0.93, 0.86, 0.68];
black   = [0.13, 0.14, 0.17];
tipC    = [0.15, 0.18, 0.21];
scarf   = [0.16, 0.68, 0.76, NOGLOW];
scarfDk = [0.1, 0.4, 0.5];
orbC    = [0.3, 0.78, 1, GLOW];
orbCore = [0.93, 1, 1, GLOW];
boltPale = [0.72, 0.97, 0.98, GLOW];
boltCyan = [0.2, 0.85, 0.88, GLOW];
silver  = [0.8, 0.85, 0.9, NOGLOW];
steel   = [0.4, 0.48, 0.54];
claw    = [0.9, 0.95, 0.95, NOGLOW];
earIn   = [0.9, 0.86, 0.76];
eyeW    = [0.62, 0.94, 0.94, NOGLOW];
eyeI    = [0.08, 0.6, 0.85, NOGLOW];
eyeP    = [0.03, 0.08, 0.2];

// ---------------------------------------------------------------- tails (pp frame: x = sheet x, y = depth, z)
RT = [1.75, 5.5, 11.5];
// tip x, tip z, half-width, bend, tip depth, cream tip
TAILS = [
  [-22.5, 13.5, 3.9, 1.2, 4.5, 0],
  [-22.2, 29, 4.4, 1.8, 6, 0],
  [-18.6, 36, 4.3, 1.2, 7.5, 0],
  [-10.2, 38.6, 4.1, 1.0, 8.5, 0],
  [5, 39.6, 4.0, -1.0, 9, 0],
  [19.6, 33.6, 4.3, -1.2, 7.5, 0],
  [22.2, 26, 4.4, -1.8, 6.5, 0],
  [22.2, 11, 3.9, -1.2, 4.5, 0],
  [12.8, 4.6, 3.0, -1.5, 3, 1],
];
TK = 0.7;
function tL(t) = norm([t[0] - RT[0], t[1] - RT[2]]);
function tN(t) = [-(t[1] - RT[2]), t[0] - RT[0]] / tL(t);
function tP(t, u) = let(n = tN(t), b = t[3] * sin(180 * u))
  [RT[0] + (t[0] - RT[0]) * u + n[0] * b, RT[1] + (t[4] - RT[1]) * u, RT[2] + (t[1] - RT[2]) * u + n[1] * b];
function tR(t, u) = t[2] * lookup(u, [[0, 0.5], [0.2, 0.85], [0.5, 1], [0.76, 0.9], [0.88, 0.6], [1, 0.14]]);
module tball(t, u, g = 1) { translate(tP(t, u)) scale([tR(t, u) * g, tR(t, u) * TK * g, tR(t, u) * g]) sphere(1, $fn = 20); }
module tail(t) {
  color(fur) for (s = [[0, 0.2], [0.2, 0.5], [0.5, 0.76]]) hull() { tball(t, s[0]); tball(t, s[1]); }
  color(t[5] ? cream : tipC) for (s = [[0.76, 0.88], [0.88, 1]]) hull() { tball(t, s[0], 1.03); tball(t, s[1], 1.03); }
}
// a lightning zigzag over tail t from u0 to u1, on its front (side -1) or back (+1)
module zig(t, u0, u1, side, c, n = 6) {
  J = [0, 0.38, -0.2, 0.3, -0.42, 0.12, -0.3, 0.4, -0.05];
  pts = [for (k = [0 : n]) let(u = u0 + (u1 - u0) * (k + (k % 3 == 1 ? 0.35 : 0)) / (n + 0.35), nn = tN(t), a = J[k % 9] * tR(t, u))
    tP(t, u) + [nn[0] * a, side * (tR(t, u) * TK * 0.95 + 0.08), nn[1] * a]];
  chain(pts, [for (k = [0 : n]) k == n ? 0.08 : 0.22], c);
}
pp(0) {
  for (t = TAILS) tail(t);
  for (z = [[1, 0.3, 0.7], [2, 0.35, 0.72], [5, 0.3, 0.7], [6, 0.32, 0.72]]) zig(TAILS[z[0]], z[1], z[2], -1, boltPale);
  for (z = [[0, 0.25, 0.75], [1, 0.3, 0.8], [3, 0.3, 0.75], [6, 0.25, 0.8], [7, 0.25, 0.75], [8, 0.2, 0.8], [5, 0.35, 0.8]])
    zig(TAILS[z[0]], z[1], z[2], 1, boltCyan, 7);
}

// ---------------------------------------------------------------- legs: crouched, wide, black socks
mirror_x() {
  limb([3.0, 0.4, 11], [6.6, -1.6, 6.6], 3.3, 2.4, fur);
  ell([3.0, 3.2, 3.2], [3.4, -0.2, 10.2], fur);
  limb([5.0, -0.6, 8.8], [6.6, -1.6, 6.6], 2.5, 2.35, black);
  limb([6.6, -1.6, 6.6], [8.2, -1.4, 2.0], 2.1, 1.5, black);
  blob([[[2.1, 2.3, 1.3], [8.6, -1.8, 1.3]], [[2.0, 1.6, 1.1], [9.6, -4.0, 1.1]]], black);
  for (a = [-35, 0, 35]) spike([9.6 + sin(a + 20) * 1.4, -4.6 - cos(a) * 0.6, 0.8], [sin(a + 20) * 0.7, -1.4, -0.5], 0.48, 0.05, claw);
  // a steel greave on the shin
  color(steel) translate([7.5, -2.9, 4.2]) rotate([10, 0, 0]) scale([0.9, 0.45, 1.5]) sphere(1, $fn = 12);
}

// ---------------------------------------------------------------- torso
module torso(g = 0) blob([[[3.5 + g, 3.2 + g, 3.0 + g], [0, 0.6, 12]], [[3.6 + g, 3.0 + g, 3.4 + g], [0, -0.6, 18]], [[2.6 + g, 2.4 + g, 2 + g], [0.2, -0.8, 22]]], fur);
torso();
// cream belly strip
color(cream) intersection() { torso(0.25); translate([-1.9, -10, 8.5]) cube([3.8, 8.2, 12.5]); }
// neck
ell([2.3, 2.2, 2.4], [0.5, -0.8, 24.5], fur);
// medallion with a swirl
color(scarfDk) translate([-0.2, -3.25, 19.4]) rotate([80, 0, 0]) cylinder(h = 0.5, r = 1.2, center = true, $fn = 20);
color(eyeW) translate([-0.2, -3.5, 19.45]) rotate([80, 0, 0]) cylinder(h = 0.3, r = 0.7, center = true, $fn = 16);
color(scarfDk) translate([-0.2, -3.62, 19.47]) rotate([80, 0, 0]) cylinder(h = 0.2, r = 0.3, center = true, $fn = 10);

// ---------------------------------------------------------------- scarf
color(scarf) hull() {
  translate([0.2, -0.9, 23.2]) scale([4.4, 3.9, 1.5]) sphere(1, $fn = 28);
  translate([-0.3, -3.0, 21.9]) scale([2.6, 1.1, 1.3]) sphere(1, $fn = 16);
}
// a short loose flap at the far side
color(scarf) hull() { translate([-3.4, -2.6, 22.6]) scale([1, 0.6, 1.2]) sphere(1, $fn = 12); translate([-6.2, -3.6, 21.4]) scale([0.6, 0.4, 0.8]) sphere(1, $fn = 10); }
RIB_UP = [[4.2, 24.2], [4.5, 25.6], [6, 29], [7.4, 30], [7, 28.3], [10.4, 27.5], [12, 26.5], [9.1, 24.4], [5.3, 23.6]];
RIB_LO = [[4.6, 23.3], [7, 22.9], [8.5, 21.9], [11.5, 22.3], [14.1, 22.5], [15.4, 22], [16.7, 23.5], [17.1, 21.6], [18.1, 20.4], [16, 20.8], [15.4, 19.1], [15, 20.2], [13.3, 21.2], [11.8, 21.4], [8.9, 20.6], [5.2, 22.4]];
pp(-2.2) { slab(RIB_UP, 1.4, scarf, inset = 0.8); slab(RIB_LO, 1.4, scarf, inset = 0.8); }

// ---------------------------------------------------------------- arms
// left (+X): hangs, black forearm with a silver spiked bracer
limb([3.4, -0.4, 20.8], [6.4, -1.2, 15.6], 1.5, 1.25, fur);
limb([6.4, -1.2, 15.6], [7.2, -2.4, 10.8], 1.2, 1.0, black);
ell([1.15, 1.3, 1.0], [7.4, -2.8, 10.0], black);
for (a = [-30, 0, 30]) spike([7.4 + sin(a) * 0.6, -3.6, 9.4], [sin(a) * 0.4, -0.7, -1.0], 0.3, 0.05, claw);
color(silver) hull() { translate([7.2, -1.0, 14.8]) scale([0.8, 1.0, 0.8]) sphere(1, $fn = 12); translate([7.8, -2.0, 11.6]) scale([0.6, 0.8, 0.6]) sphere(1, $fn = 10); }
spike([6.8, -0.9, 16.0], [0.6, 0.9, 4.2], 0.6, 0.05, silver);
spike([7.6, -1.3, 13.4], [1.4, 0.6, 2.4], 0.45, 0.05, silver);
// right (-X): out to the side, the orb cradled in its paw
ORB = [-12.1, -8.1, 19.6];
limb([-3.4, -0.4, 20.8], [-6.6, -4.2, 18.2], 1.5, 1.25, fur);
limb([-6.6, -4.2, 18.2], [-9.4, -6.8, 17.2], 1.2, 1.0, black);
ell([1.25, 1.25, 1.1], [-10.1, -7.4, 17.3], black);
for (a = [-35, 0, 35]) let(q = [-10.1, -7.4, 17.3] + [-0.7, -0.7, 0] + [sin(a) * 0.6, -sin(a) * 0.6, 0]) spike(q, [-0.4, -0.4, 1.2], 0.28, 0.05, claw);
color(orbC) translate(ORB) sphere(3.0, $fn = 28);
color(orbCore) translate(ORB + [0.2, -1.3, 0.2]) sphere(1.9, $fn = 20);
// crackles round the orb
for (a = [20 : 72 : 340]) let(d = [cos(a), 0.25, sin(a)], q = [-sin(a), 0, cos(a)])
  chain([ORB + d * 2.9, ORB + d * 3.9 + q * 0.6, ORB + d * 4.8 - q * 0.5, ORB + d * 5.9 + q * 0.3], [0.22, 0.2, 0.18, 0.06], boltPale);

// ---------------------------------------------------------------- head (turned to its right, the viewer's left)
H = [0.9, -1.2, 27.7];
HY = -25;
HS = 1.28;
translate(H) rotate([0, 0, HY]) scale(HS) {
  blob([[[3.3, 3.1, 2.9], [0, 0, 0.2]], [[2.4, 2.2, 2.0], [0, -1.6, -0.8]]], fur);
  blob([[[1.9, 1.8, 1.5], [0, -2.6, -0.9]], [[0.85, 0.95, 0.8], [0, -5.7, -1.1]]], fur);
  // cream lower muzzle and cheeks
  color(cream) intersection() {
    hull() {
      translate([0, -1.4, -1.2]) scale([2.7, 2.4, 1.9]) sphere(1, $fn = 22);
      translate([0, -2.7, -1.0]) scale([1.95, 1.85, 1.45]) sphere(1, $fn = 18);
      translate([0, -5.65, -1.2]) scale([0.9, 1.0, 0.75]) sphere(1, $fn = 12);
    }
    translate([-10, -10, -10]) cube([20, 20, 9.3]);
  }
  mirror_x() color(cream) hull() { translate([2.6, -0.6, -1.3]) sphere(1.0, $fn = 12); translate([4.3, 0.5, -2.1]) sphere(0.25, $fn = 8); }
  ell([0.55, 0.45, 0.45], [0, -6.4, -0.85], black);
  mirror_x() limb([0.6, -5.3, -1.9], [1.7, -3.2, -2.1], 0.13, 0.13, black);
  // fierce slanted eyes: black rim, cyan eye, an orange scowl over them
  mirror_x() {
    color(black) translate([1.6, -2.45, 0.5]) rotate([0, 0, 28]) rotate([0, -20, 0]) scale([1.3, 0.5, 0.92]) sphere(1, $fn = 14);
    eye([1.6, -2.6, 0.5], 0.92, iris = eyeI, sclera = eyeW, pupil = eyeP, yaw = 28, flat = 0.45,
        lid = 0.3, lid_tilt = 24, lid_c = fur, squint = 0.15, slit = 0.55, shine = true);
    color(fur) hull() {
      translate([0.55, -3.1, 1.25]) scale([0.4, 0.4, 0.28]) sphere(1, $fn = 10);
      translate([1.6, -2.7, 1.8]) scale([0.7, 0.45, 0.28]) sphere(1, $fn = 10);
      translate([2.6, -1.8, 2.2]) scale([0.45, 0.45, 0.28]) sphere(1, $fn = 10);
    }
  }
  // tall splayed ears with black tips and a pale inside
  mirror_x() {
    color(fur) hull() { translate([2.0, 0.2, 2.3]) scale([1.9, 0.9, 1.6]) sphere(1, $fn = 14); translate([4.1, 0.6, 7.6]) sphere(0.35, $fn = 8); }
    color(black) hull() { translate([3.25, 0.45, 5.1]) scale([1.1, 0.6, 0.5]) sphere(1, $fn = 10); translate([4.1, 0.6, 7.65]) sphere(0.39, $fn = 8); }
    color(earIn) hull() { translate([2.2, -0.6, 3.0]) scale([0.95, 0.2, 1.0]) sphere(1, $fn = 10); translate([3.2, 0.0, 4.7]) sphere(0.25, $fn = 6); }
  }
}
