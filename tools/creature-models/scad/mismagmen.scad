// Mismagmen: Miscarmen grown into a ghostly witch. Remodelled from the sprite 2026-11-04 (second pass: soft witch hat,
// face sitting on the gown, the gown flowing into its tentacles).
// Checklist (front sheet, 40 units tall):
//   - Hat: a soft white witch hat, the brim a floppy mushroom cap (sheet x -16.6..14, z 27..31) drooping down at both
//     sides, its crown a bent cone (x -8..4, z 30..35) leaning over to the viewer's right, a lavender band at its foot.
//   - Olive-yellow tufts like sparks or flames with ragged edges: a big one on the crown tip (1.5, 36.7), one hanging
//     off the brim's right rim (10.2, 25), one on the brim right of the crown (6.3, 31.7), one on the brim's back left
//     (-9.4, 32.5), more over the back of the brim (the back art is covered in them).
//   - Face: the lavender-grey bowl under the brim, filling the space down to the gown (no neck). Two big glaring
//     almond eyes (near -2.1, far -8.5, z 25.5), yellow with a blue iris, a heavy black upper lid sloping to the nose
//     and a glint; a blue zig-zag fanged grin below them (-5, 24.4); the bowl's lower front white (the chin,
//     -6..0, z 19.5..24); a little orange earring under the left side (-10, 21.5).
//   - Gown: white with lavender folds, from a collar under the face (teal studs (-3.1, 17.8) and (1, 17.7), a teal
//     brooch (-1.6, 16)) widening down into the tentacles.
//   - Tentacles: fifteen thin pale ones flowing out of the hem as one mass, overlapping, swirling a little, curling
//     up at their olive tips; one raised like an arm to the right (to 15, 16.5), one reaching far right (to 16, 7).
//   - Back: the brim and crown covered in tufts, the tentacles hanging out round the hem.
include <lib.scad>

white = [0.96, 0.96, 0.98];
lav = [0.75, 0.75, 0.84];
lavDk = [0.6, 0.6, 0.7];
tend = [0.88, 0.88, 0.93];
olive = [0.71, 0.72, 0.3, NOGLOW];
oliveLt = [0.82, 0.85, 0.37, NOGLOW];
spark = [0.96, 0.9, 0.23, GLOW];
teal = [0.05, 0.63, 0.7, NOGLOW];
tealLt = [0.6, 0.95, 0.95, NOGLOW];
ink = [0.1, 0.09, 0.12];
blue = [0.1, 0.55, 0.88, NOGLOW];
yel = [0.98, 0.86, 0.2, NOGLOW];
orange = [0.98, 0.7, 0.1, NOGLOW];

HX = -0.5;          // the hat / face bowl's axis (x; y = 0)
SY = 0.78;          // the bowl and brim are oval, shallower front to back
G = [0.6, 0, 0];    // the gown's axis
BOWL = [[3.4, 19.6], [7, 20.2], [10.5, 21.3], [12.8, 22.8], [13.8, 24.5], [14.1, 26.3], [14, 27.6], [13.6, 28.3]];
GOWN = [[8.6, 9.5], [9.3, 10.4], [8.7, 12.2], [7.3, 14.6], [5.7, 16.7], [4.3, 18.6], [3, 19.8]];
EYE_L = [3.4, -10.25, 26.8];
EYE_R = [-4.4, -10.25, 26.8];
ES = 1.7;      // eye size
EW = 1.3;      // eyes stretched across ...
EH = 0.85;     // ... and flattened: wide almonds

// ---- The brim: a floppy cap, the top at z 33 on the axis curving down to a rim that droops lowest at the sides.
BR = 16.6;
function rimZ(a) = 29.2 - 2.8 * pow(cos(a), 2);
function capZ(r, a) = 33 - (33 - rimZ(a)) * pow(r / BR, 2.2);
function brimTop(x, y) = let(u = x - HX, v = y / SY) capZ(min(BR, norm([u, v])), atan2(v, u));
RINGS = [2.5, 6, 9.5, 12.5, 14.6, 15.9, 16.6];
NA = 40;
module brimSheet(dz, th0, th1) {
  R = len(RINGS);
  zt = function(i, a) capZ(RINGS[i], a) - (i == R - 1 ? 0.35 : 0) + dz;
  th = function(i) i == R - 1 ? 0.35 : th0 + (th1 - th0) * RINGS[i] / BR;
  pt = function(i, j, bot) let(a = j * 360 / NA, r = RINGS[i]) [HX + r * cos(a), SY * r * sin(a), zt(i, a) - (bot ? th(i) : 0)];
  T = function(i, j) i * NA + (j % NA);
  B = function(i, j) R * NA + i * NA + (j % NA);
  polyhedron(
    points = concat([for (i = [0 : R - 1], j = [0 : NA - 1]) pt(i, j, false)], [for (i = [0 : R - 1], j = [0 : NA - 1]) pt(i, j, true)],
                    [[HX, 0, 33 + dz], [HX, 0, 33 + dz - th0]]),
    faces = concat(
      [for (i = [0 : R - 2], j = [0 : NA - 1]) [T(i, j), T(i, j + 1), T(i + 1, j + 1), T(i + 1, j)]],
      [for (i = [0 : R - 2], j = [0 : NA - 1]) [B(i, j), B(i + 1, j), B(i + 1, j + 1), B(i, j + 1)]],
      [for (j = [0 : NA - 1]) [T(R - 1, j), T(R - 1, j + 1), B(R - 1, j + 1), B(R - 1, j)]],
      [for (j = [0 : NA - 1]) [2 * R * NA, T(0, j + 1), T(0, j)]],
      [for (j = [0 : NA - 1]) [2 * R * NA + 1, B(0, j), B(0, j + 1)]]));
}
color(white) brimSheet(0, 0.9, 0.5);
color(lav) brimSheet(-0.3, 0.6, 0.3);   // its underside, lavender

// The crown: a bent cone leaning over to the viewer's right, a lavender band at its foot.
CR = [[-0.6, 1.8, 34, 3.6], [1.4, 2.6, 35.8, 2.2], [3.6, 3.1, 36.7, 1.2], [5.2, 3.3, 36.2, 0.55]];
color(white) hull() {
  translate([-2, 1, 31.8]) scale([6.4, 5, 1.2]) sphere(1, $fn = 30);
  translate([CR[0][0], CR[0][1], CR[0][2]]) sphere(CR[0][3], $fn = 20);
}
for (i = [0 : len(CR) - 2]) limb([CR[i][0], CR[i][1], CR[i][2]], [CR[i + 1][0], CR[i + 1][1], CR[i + 1][2]], CR[i][3], CR[i + 1][3], white);
color(lavDk) translate([-2, 1, 32.2]) scale([6.25, 4.9, 0.5]) sphere(1, $fn = 30);

// A tuft of olive sparks: soft flame tongues of different lengths fanned mostly upwards from a puffy core, flattened
// to face the viewer, two tongues front and back so it reads from the side.
FL = [[-100, 0.66], [-62, 0.98], [-30, 0.8], [-4, 1.2], [28, 0.95], [58, 1.1], [92, 0.72], [140, 0.55], [-145, 0.5]];
module tuft(p, r, rot = [0, 0, 30]) {
  translate(p) rotate(rot) scale([1, 0.62, 1]) {
    $fn = 7;
    color(oliveLt) sphere(r * 0.55, $fn = 12);
    for (k = [0 : len(FL) - 1]) let(a = FL[k][0], l = r * FL[k][1])
      limb([0, 0, 0], [l * sin(a), 0, l * cos(a)], r * 0.42, r * 0.13, k % 3 == 1 ? olive : oliveLt);
    limb([0, 0, 0], [0.25 * r, -0.85 * r, 0.45 * r], r * 0.38, r * 0.12, oliveLt);
    limb([0, 0, 0], [-0.2 * r, 0.85 * r, 0.35 * r], r * 0.38, r * 0.12, olive);
    color(spark) translate([r * 0.15, -r * 0.42, r * 0.2]) sphere(r * 0.2, $fn = 8);
  }
}
module tuftOn(x, y, dz, r, rot = [0, 0, 30]) tuft([x, y, brimTop(x, y) + dz], r, rot);
tuft([1.6, 3, 37.9], 4.4);                       // the crown tip
tuft([14.5, -4.5, 26.4], 3.8, [0, 25, 30]);      // hanging off the right rim
tuftOn(6.6, 3, 0.7, 3);                          // right of the crown
tuftOn(-12.8, 4, 1, 2.8);                        // back left
tuftOn(-7, 8, 0.7, 2.6, [0, 0, 180]);
tuftOn(5, 8.5, 0.7, 2.6, [0, 0, 160]);
tuftOn(-1, 10, 0.7, 2.3, [0, 0, 200]);
tuftOn(10.5, 6, 0.7, 2.3, [0, 0, 120]);
tuftOn(-12, -4, 0.7, 2, [0, 0, -10]);

// ---- Face: the lavender bowl under the brim, down to the gown.
translate([HX, 0, 0]) scale([1, SY, 1]) lathe(BOWL, lav, 56);
// The chin: the bowl's lower front painted white.
color(white) intersection() {
  translate([HX, 0, 0]) scale([1, SY, 1]) lathe([for (q = BOWL) [q[0] + 0.22, q[1]]], white, 56);
  prism([[-7, 23.6], [-3.6, 23.2], [-0.8, 23.8], [1, 23], [0.6, 20.4], [-3, 19.5], [-6.6, 20.4]]);
  translate([-20, -20, 17]) cube([40, 14, 10]);
}
// Eyes: big glaring almonds, yellow with a blue iris, a heavy ink upper lid and a glint; each stretched EW across and
// EH up and down in its own (yawed) frame.
module almond(p, yaw) translate(p) rotate([0, 0, yaw]) scale([EW, 1, EH]) rotate([0, 0, -yaw]) translate(-p) children();
almond(EYE_L, 13) eye(EYE_L, ES, iris = blue, sclera = yel, yaw = 13, pupil = ink, lid = 0.3, lid_tilt = 22, lid_c = ink, squint = 0.12, shine = true);
almond(EYE_R, -13) eye(EYE_R, ES, iris = blue, sclera = yel, yaw = -13, pupil = ink, lid = 0.3, lid_tilt = 22, lid_c = ink, squint = 0.12, shine = true);
// The blue zig-zag grin.
MOUTH = [[-2.2, -10.4, 24.6], [-1.1, -10.6, 24], [0, -10.65, 24.55], [1.1, -10.6, 24], [2.2, -10.4, 24.6]];
for (i = [0 : 3]) limb(MOUTH[i] + [HX, 0, 0], MOUTH[i + 1] + [HX, 0, 0], 0.3, 0.3, blue);
// The orange earring under the left side.
limb([-9.5, -5, 21.8], [-9.5, -5, 20.6], 0.22, 0.22, orange);
color(orange) translate([-9.5, -5, 20.1]) scale([0.65, 0.65, 0.85]) sphere(1, $fn = 12);

// ---- Gown: white, widening from the collar under the face down into the tentacles, lavender folds.
translate(G) lathe(GOWN, white, 44);
color(white) translate([0.6, 0, 18.9]) scale([4.8, 4.6, 0.9]) sphere(1, $fn = 24);
function gr(z) = lookup(z, [for (q = GOWN) [q[1], q[0]]]);
for (a = [-125, -80, -35, 10, 55, 100, 150, 200, 250]) {
  chain([for (z = [18.4, 14.8, 11.6, 10]) G + [(gr(z) + 0.08) * cos(a), (gr(z) + 0.08) * sin(a), z]], [0.16, 0.2, 0.24, 0.26], lav);
}
// Teal collar studs and the brooch.
for (t = [-45, 45]) color(teal) translate(G + [4.75 * sin(t), -4.75 * cos(t), 18.7]) sphere(0.65, $fn = 10);
translate(G) rotate([0, 0, 10]) {
  color(teal) translate([0, -5.85, 16.3]) scale([1.1, 0.7, 1.4]) sphere(1, $fn = 14);
  color(tealLt) translate([-0.3, -6.45, 16.7]) sphere(0.35, $fn = 8);
}

// ---- Tentacles: flowing out of the hem as one mass (their roots inside the gown), overlapping, swirling a little,
// curling up at their olive tips.
TP = [[7.6, 11.4], [9.6, 9.4], [11, 6.8], [12.3, 4.6], [13.1, 2.4], [14, 1], [15.3, 1.1], [16, 2.4], [15.4, 3.7]];
TH = [[7.6, 11.4], [9.6, 10.2], [11.6, 9.4], [13.8, 8.8], [15.8, 7.8], [16.8, 6.1], [16.5, 4.3], [15.4, 3.6], [14.7, 4.3]];
TARM = [[7.2, 12.8], [8.9, 12.6], [10.4, 12.8], [12.2, 14], [13.4, 15.6], [14.4, 16.9], [15.4, 16.9], [15.8, 15.8], [15.3, 15]];
TR = [1.9, 1.4, 1.1, 0.92, 0.8, 0.7, 0.6, 0.5, 0.42];
// [angle about the gown's axis (degrees from +X), profile, reach factor, swirl (degrees added along the length)]
TENDRILS = [[35, TARM, 1, 0], [0, TH, 1, 0], [60, TP, 1, 10], [85, TP, 0.95, -10], [110, TP, 0.9, 10], [135, TP, 0.85, -10],
            [160, TP, 0.8, 10], [185, TP, 0.72, -10], [210, TP, 0.68, 10], [235, TP, 0.75, -10], [255, TP, 0.85, 10],
            [275, TP, 0.95, -10], [295, TP, 1.05, 10], [315, TP, 0.95, -10], [340, TP, 1.1, 10]];
function tpts(t) = [for (i = [0 : len(t[1]) - 1]) let(q = t[1][i], r = 7.6 + (q[0] - 7.6) * t[2], a = t[0] + t[3] * i / 8)
  G + [r * cos(a), r * sin(a), q[1]]];
for (t = TENDRILS) {
  $fn = 10;
  p = tpts(t);
  chain([for (i = [0 : 4]) p[i]], [for (i = [0 : 4]) TR[i]], tend);
  chain([for (i = [4 : 8]) p[i]], [for (i = [4 : 8]) TR[i]], olive);
}
