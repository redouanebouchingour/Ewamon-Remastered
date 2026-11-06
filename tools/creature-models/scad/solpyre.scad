// Solpyre: a crimson phoenix standing upright on its talons, huge wings raised and spread in a V (fans of thick
// crimson flame-feathers with an orange edge stripe, a gold covert band along each arm, a flame feather at each tip),
// a big soft crown of fire on a small fierce head, a golden sun medallion on its chest, crimson tail feathers and a
// flame plume curling out to its left behind it, and loose flame wisps trailing under both wings.
//
// Checklist (sheet units; the art stands on a ground fire + lava rock up to sheet z 5, not modelled: G below):
// - face: small orange head (sheet x -2.5..2, z 24..30), a pale gold hooked beak pointing down-left (x -4.2..-2.5,
//   z 24.3..27.5), one small fierce amber eye at (-1, 27.5) under a dark slanted brow; two eyes on the model.
// - crest: a big flame crown x -6..5.8, z 28.5..37.7: about eight tongues, yellow core, orange, red-orange tips.
// - body: upright, slim, red with crimson shading (x -4..3.8 at z 14), an orange throat, an orange belly patch on
//   the near side (x 1..3, z 9..15); the medallion x -4.2..0.5, z 15.5..22 (bronze rim, gold disc, bright centre).
// - legs: crimson feathered thighs to z 10.5, tan shanks splayed out, three long toes + a back toe, feet x -5.9..-1.8
//   and 1.8..6.2, soles at z 5.2.
// - wings: arm from the shoulder (3, 23) to the wrist (9.8, 31.2) and hand (12.5, 34); seven primaries fanning from
//   straight up (tip 17.7, 40) to down-right (15.3, 19.7), five secondaries hanging from the forearm (tips 5.5..11.3,
//   z 15.3..17.6), a flame feather outside the tip (20.2, 38.8), a small flame at the wrist.
// - tail: crimson feathers from the rump down-right (tips 7.5..11, z 7.5..10.5), a flame plume curling out to
//   x 17.8 and back under itself (z 6.5..12.3). Back art: same, the tail on the creature's +X side.
// - wisps: flame curls floating under the wings, x 10.7..19.4, z 12.6..23.6 and x -15..-6, z 11..17.5.
include <lib.scad>

G = 5;   // the art's sole line (sheet z) above its ground fire: everything is modelled G lower

// colours
bodyRed = [0.75, 0.26, 0.15];
crimson = [0.66, 0.14, 0.22];
crimsonDk = [0.44, 0.1, 0.16];
crimsonMid = [0.56, 0.12, 0.19];
orange = [0.9, 0.44, 0.13];
headC = [0.86, 0.36, 0.12];
stripe = [0.87, 0.36, 0.07];
gold = [0.97, 0.66, 0.16, NOGLOW];
goldHi = [0.98, 0.72, 0.12, NOGLOW];
bronze = [0.68, 0.44, 0.16];
flameO = [0.98, 0.48, 0.03, NOGLOW];     // the crown's orange: lit it washes out to pale lemon in game
flameOn = [0.97, 0.47, 0.04, NOGLOW];    // the same orange, not lit, on the wings, the tail plume and the wisps
flameY = [0.99, 0.79, 0.07, NOGLOW];     // lit, the crown's heart read as a glowing third eye in game
flameR = [0.79, 0.23, 0.02];
tan = [0.8, 0.51, 0.3];
tanDk = [0.53, 0.3, 0.18];
beakC = [0.94, 0.7, 0.36, NOGLOW];
browC = [0.24, 0.05, 0.07];
scaleA = [0.82, 0.32, 0.15];             // breast feather lobes: light, dark, orange
scaleB = [0.6, 0.13, 0.2];
scaleO = [0.93, 0.5, 0.16, NOGLOW];

// a point read off the front sheet (sheet x, sheet z) at depth y, in the model frame
function F(s, z, y = 0) = fromSheet(s, z - G, y);
// a wing feather tip: the fan spread 8 % wider than read off the sheet (the model's projected height includes its
// forward toes, so it came out narrower than the art)
function FT(s, z, y = 0) = F(s * 1.08, z, y);

// Feather blade from a to b: a round base disc (half-width w, half-thickness t along Y), nearly parallel sides, then
// a pointed tip.
module blade(a, b, w, t, c) {
  color(c) hull() {
    translate(a) scale([w, t, w]) sphere(1, $fn = 8);
    translate(a + (b - a) * 0.66) scale([w * 0.9, t * 0.85, w * 0.9]) sphere(1, $fn = 8);
    translate(b) sphere(0.12, $fn = 6);
  }
}
// unit normal to a-b in the XZ plane, on the leading (upper / outer-top) side
function nrm(a, b) = let(d = b - a, l = norm([d[0], d[2]])) [-d[2] / l, 0, d[0] / l];

// One flight feather: a thick crimson blade, an orange stripe along its upper edge and a gold covert over its base.
module flight(a, b, w, c, cov = gold) {
  n = nrm(a, b);
  blade(a, b, w, 0.42, c);
  blade(a + n * w * 0.6 + (b - a) * 0.08, a + (b - a) * 0.88 + n * w * 0.2, w * 0.3, 0.5, stripe);
  blade(a - (b - a) * 0.04, a + (b - a) * 0.34, w * 0.92, 0.6, cov);
}

// Soft flame tongue from a to b (half-width r, flattened to k along Y): orange, a yellow core low down, red only at
// the very tip. `bend` pushes the middle aside so the tongue curls.
module tongue(a, b, r, k = 0.6, bend = [0, 0, 0], c = flameO) {
  m = a + (b - a) * 0.45 + bend;
  q = m + (b - m) * 0.62;
  color(c) hull() {
    translate(a) scale([r, r * k, r]) sphere(1, $fn = 8);
    translate(m) scale([r * 0.82, r * 0.82 * k, r * 0.82]) sphere(1, $fn = 8);
  }
  color(c) hull() {
    translate(m) scale([r * 0.82, r * 0.82 * k, r * 0.82]) sphere(1, $fn = 8);
    translate(q) scale([r * 0.36, r * 0.36 * k, r * 0.36]) sphere(1, $fn = 8);
  }
  color(flameR) hull() {
    translate(q) scale([r * 0.34, r * 0.4 * k, r * 0.34]) sphere(1, $fn = 8);
    translate(b) sphere(0.1, $fn = 6);
  }
  // yellow core, a little proud of both faces
  color(flameY) hull() {
    translate(a + [0, 0, r * 0.15]) scale([r * 0.55, r * 0.55 * k * 1.25, r * 0.55]) sphere(1, $fn = 8);
    translate(a + (m - a) * 1.25) scale([r * 0.3, r * 0.3 * k * 1.25, r * 0.3]) sphere(1, $fn = 8);
  }
}

// Flame streak along a curve (wisps, the tail plume): orange links, a yellow core on the thick part, a red tip.
module streak(pts, rs, k = 0.6, c = flameOn) {
  n = len(pts);
  for (i = [0 : n - 3]) color(c) hull() {
    translate(pts[i]) scale([rs[i], rs[i] * k, rs[i]]) sphere(1, $fn = 8);
    translate(pts[i + 1]) scale([rs[i + 1], rs[i + 1] * k, rs[i + 1]]) sphere(1, $fn = 8);
  }
  q = pts[n - 2] + (pts[n - 1] - pts[n - 2]) * 0.4;
  color(c) hull() {
    translate(pts[n - 2]) scale([rs[n - 2], rs[n - 2] * k, rs[n - 2]]) sphere(1, $fn = 8);
    translate(q) scale([rs[n - 2] * 0.7, rs[n - 2] * 0.7 * k, rs[n - 2] * 0.7]) sphere(1, $fn = 8);
  }
  color(flameR) hull() {
    translate(q) scale([rs[n - 2] * 0.66, rs[n - 2] * 0.75 * k, rs[n - 2] * 0.66]) sphere(1, $fn = 8);
    translate(pts[n - 1]) sphere(0.1, $fn = 6);
  }
  for (i = [0 : max(0, floor(n / 2) - 1)]) color(flameY) hull() {
    translate(pts[i]) scale([rs[i] * 0.5, rs[i] * 0.5 * k * 1.3, rs[i] * 0.5]) sphere(1, $fn = 8);
    translate(pts[i + 1]) scale([rs[i + 1] * 0.5, rs[i + 1] * 0.5 * k * 1.3, rs[i + 1] * 0.5]) sphere(1, $fn = 8);
  }
}

// Hard dark brow over an eye at p (radius s, yaw like the eye), slanting down towards the beak.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.2]) scale([s * 0.55, s * 0.6, s * 0.3]) sphere(1, $fn = 10);
    translate([-s * 0.95, -s * 0.25, s * (1.2 - drop)]) scale([s * 0.45, s * 0.55, s * 0.28]) sphere(1, $fn = 10);
  }
}

// ---------------------------------------------------------------- wings
WY = 0;   // the wing plane's depth (behind the body's centre)
module wing() {
  // the arm: shoulder, wrist, hand (orange leading edge)
  arm = [F(2.5, 22.2, WY - 0.3), F(6, 26.6, WY - 0.4), F(9.8, 31.2, WY - 0.4), F(12.6, 34.2, WY - 0.1)];
  // a broad flat band (orange, a gold stripe down its middle), not a rod
  AR = [1.15, 1.05, 0.9, 0.5];
  for (i = [0 : 2]) color(orange) hull() {
    translate(arm[i]) scale([AR[i], 0.62, AR[i]]) sphere(1, $fn = 10);
    translate(arm[i + 1]) scale([AR[i + 1], 0.62, AR[i + 1]]) sphere(1, $fn = 10);
  }
  for (i = [0 : 1]) color(goldHi) hull() {
    translate(arm[i] + [0.35, 0, -0.35]) scale([AR[i] * 0.4, 0.72, AR[i] * 0.4]) sphere(1, $fn = 8);
    translate(arm[i + 1] + [0.35, 0, -0.35]) scale([AR[i + 1] * 0.4, 0.72, AR[i + 1] * 0.4]) sphere(1, $fn = 8);
  }
  // lesser coverts along the forearm: short gold-orange blades pointing down the wing
  for (i = [0 : 3]) let(t = 0.14 + i * 0.24, p = arm[0] + (arm[2] - arm[0]) * t)
    blade(p + [0, -0.15, 0], p + [2.6, -0.15, -1.7], 0.9, 0.55, [0.95, 0.56, 0.12, NOGLOW]);
  // primaries from the hand, straight up to out sideways (alternating depth so the fan has layers)
  P = [
    [[11.8, 33.2], [17.7, 40.0], 1.15],
    [[11.6, 31.6], [20.3, 33.6], 1.35],
    [[10.9, 30.4], [19.9, 29.7], 1.4],
    [[10.1, 29.3], [18.9, 25.4], 1.4],
    [[9.2, 28.2], [17.5, 23.3], 1.4],
    [[8.3, 27.1], [17.3, 21.8], 1.35],
    [[7.4, 26.0], [15.3, 19.7], 1.35],
  ];
  for (i = [0 : len(P) - 1]) let(e = P[i], y = WY + (i % 2) * 0.35)
    flight(F(e[0][0], e[0][1], y), FT(e[1][0], e[1][1], y + 0.3), e[2], i % 2 == 0 ? crimson : crimsonMid, i % 2 == 0 ? gold : goldHi);
  // a dark under-layer between the primaries, behind them, so the fan has no gaps
  for (i = [0 : len(P) - 2]) let(a = (P[i][0] + P[i + 1][0]) / 2, b = (P[i][1] + P[i + 1][1]) / 2)
    blade(F(a[0], a[1], WY + 0.75), FT(a[0] + (b[0] - a[0]) * 0.92, a[1] + (b[1] - a[1]) * 0.92, WY + 0.95), 1.3, 0.35, crimsonDk);
  // secondaries hanging from the forearm
  S = [
    [[6.5, 25.0], [12.6, 18.2], 1.3],
    [[5.6, 24.0], [9.6, 16.4], 1.25],
    [[4.7, 23.0], [7.6, 15.3], 1.15],
    [[3.8, 22.4], [5.3, 16.6], 1.05],
  ];
  for (i = [0 : len(S) - 1]) let(e = S[i], y = WY + 0.15 + (i % 2) * 0.35)
    flight(F(e[0][0], e[0][1], y), FT(e[1][0], e[1][1], y), e[2], i % 2 == 0 ? crimsonMid : crimson, i % 2 == 0 ? goldHi : gold);
  // the flame feather outside the wing tip and the little flame at the wrist
  tongue(F(13.6, 32.6, WY - 0.2), FT(20.2, 38.8, WY + 0.3), 1.0, 0.55, F(0.4, -0.6, 0) + [0, 0, G], flameOn);
  tongue(F(9.6, 31.6, WY - 0.6), F(10.8, 35.2, WY - 0.6), 0.6, 0.6, c = flameOn);
}
mirror_x() wing();

// ---------------------------------------------------------------- legs and talons
mirror_x() {
  ell([2.3, 2.2, 2.6], [2.7, -0.3, 7.0], crimson);                 // thick feathered thigh
  limb([2.9, -0.5, 4.8], [3.9, -0.9, 1.4], 0.72, 0.55, tan);       // shank, splayed out
  for (a = [-38, 0, 38]) let(e = [3.9 + sin(a) * 2.5, -0.9 - cos(a) * 2.5, 0.35]) {
    limb([3.9, -0.9, 1.1], e, 0.5, 0.26, tan);
    spike(e, [sin(a) * 0.8, -cos(a) * 0.8, -0.35], 0.26, 0.05, tanDk);
  }
  limb([3.9, -0.9, 1.1], [4.2, 0.8, 0.35], 0.42, 0.24, tan);
  spike([4.2, 0.8, 0.35], [0.1, 0.7, -0.3], 0.22, 0.05, tanDk);
}

// ---------------------------------------------------------------- body: broad and deep, the breast ~8.6 wide as drawn
TL = [[4.5, 4.1, 5.0], [0, 0.4, 9.8]];    // belly and lower body
TC = [[4.3, 3.9, 4.0], [0, 0.0, 14.6]];   // the full breast the medallion sits on
blob([TL, TC], bodyRed);
ell([2.5, 2.5, 2.8], [0, -0.4, 18.6], bodyRed);                  // thick neck
mirror_x() ell([1.6, 1.5, 1.8], [2.4, 0.6, 16.8], bodyRed);       // shoulders, under the wing roots
// orange throat over the medallion
color(orange) intersection() {
  translate([0, -0.4, 18.6]) scale([2.65, 2.65, 2.95]) sphere(1, $fn = 20);
  translate([0, -2.8, 17.6]) scale([2.2, 1.8, 2.2]) sphere(1, $fn = 14);
}
// layered breast feathers: low blunt lobes on the body's surface, their lower edges standing out, rows under and
// beside the medallion and over the back ([x, z, side (-1 front, 1 back), colour])
function tyE(x, z, e, sd) = let(r = e[0], c = e[1], q = 1 - pow(x / r[0], 2) - pow((z - c[2]) / r[2], 2))
  q <= 0 ? c[1] : c[1] + sd * r[1] * sqrt(q);
function ty(x, z, sd) = sd < 0 ? min(tyE(x, z, TL, sd), tyE(x, z, TC, sd)) : max(tyE(x, z, TL, sd), tyE(x, z, TC, sd));
module lobe(x, z, sd, c) let(y = ty(x, z, sd), n = [x / 20, (y - 0.2) / 16], th = atan2(n[0], -n[1]))
  color(c) translate([x, y, z] - [sin(th), -cos(th), 0] * 0.12) rotate([0, 0, th]) rotate([-14, 0, 0])
    scale([1.35, 0.42, 1.0]) sphere(1, $fn = 8);
LOBES = [
  for (x = [-3.6, -1.8, 0, 1.8, 3.6]) [x, 6.6, -1, x > 1 ? scaleO : scaleB],
  for (x = [-2.7, -0.9, 0.9, 2.7]) [x, 8.4, -1, x > 1.5 ? scaleO : scaleA],
  for (x = [-3.4, 3.4]) [x, 10.2, -1, scaleB],
  for (x = [-3.8, 3.8], z = [12.4, 14.8]) [x, z, -1, z > 13 ? scaleA : scaleB],
  for (x = [-2.4, 0, 2.4], z = [9.0, 13.4]) [x, z, 1, z > 10 ? scaleB : scaleA],
];
for (l = LOBES) lobe(l[0], l[1], l[2], l[3]);

// golden sun medallion on the chest: gold rim, engraved bronze ring, gold disc, a bright domed sun at the centre
translate([0, -3.55, 13.7]) rotate([84, 0, 0]) scale([1, 1.08, 1]) {
  color(gold) cylinder(h = 0.7, r = 2.95, $fn = 24);
  color(bronze) translate([0, 0, 0.5]) cylinder(h = 0.4, r = 2.5, $fn = 24);
  for (a = [0 : 30 : 330]) color(gold) rotate([0, 0, a]) translate([2.05, 0, 0.75]) scale([0.32, 0.16, 0.25]) sphere(1, $fn = 6);
  color(gold) translate([0, 0, 0.75]) cylinder(h = 0.35, r = 1.65, $fn = 24);
  color([0.99, 0.66, 0.1, NOGLOW]) translate([0, 0, 0.95]) scale([1.2, 1.2, 0.55]) sphere(1, $fn = 18);
}

// ---------------------------------------------------------------- head: turned a little to its right as drawn
H = [0, -0.8, 22];
translate(H) rotate([0, 0, -15]) {
  ell([2.3, 2.4, 2.6], [0, 0, 0], headC);
  ell([1.8, 1.6, 1.5], [0, -0.7, -1.4], crimson);                 // crimson throat under the beak
  // hooked pale-gold beak and its lower mandible
  color(beakC) hull() {
    translate([0, -1.9, 0.1]) scale([0.85, 0.7, 0.9]) sphere(1, $fn = 10);
    translate([0, -3.7, -0.45]) sphere(0.5, $fn = 10);
    translate([0, -4.35, -1.55]) sphere(0.16, $fn = 6);
  }
  color(tanDk) hull() {
    translate([0, -2.0, -0.85]) scale([0.6, 0.6, 0.5]) sphere(1, $fn = 10);
    translate([0, -3.4, -1.25]) sphere(0.2, $fn = 6);
  }
  mirror_x() {
    eye([1.1, -1.95, 0.4], 0.72, iris = [0.99, 0.72, 0.07, NOGLOW], sclera = [0.97, 0.84, 0.5, NOGLOW],
        pupil = [0.25, 0.05, 0.03], yaw = 28, flat = 0.5, lid = 0.38, lid_tilt = 26, lid_c = headC);
    brow([1.1, -1.95, 0.4], 0.72, 28, 0.7, browC);
  }
}

// crown of fire: a big burst about twice the drawn crest, as wide as three heads and nearly as tall as the head again
// over it. A round fireball mass on the head top with soft tongues fanning radially out of it, from flaring sideways
// to straight up, a ring of shorter ones behind, and short yellow tongues on both faces for its bright heart.
C0 = [0.2, 31.0];   // the burst's centre on the sheet
// [angle from vertical (+ = sheet right), length, width, depth, heart?]
CR = [
  [-80, 9.0, 1.8, 0.8, 0], [-56, 9.8, 1.9, 0.4, 0], [-32, 10.3, 2.0, 0.0, 0], [-11, 10.6, 2.1, -0.2, 0],
  [9, 10.4, 2.1, 0.3, 0], [30, 9.9, 2.0, 0.6, 0], [52, 9.3, 1.9, 1.0, 0], [76, 8.6, 1.8, 1.4, 0],
  [-30, 8.5, 1.9, 3.2, 0], [25, 8.5, 1.9, 3.4, 0],
  [-20, 7.6, 1.7, -1.7, 1], [12, 7.2, 1.6, -1.5, 1], [-4, 7.0, 1.6, 4.0, 1],
];
for (c = CR) let(d = [sin(c[0]), cos(c[0])], side = [cos(c[0]), -sin(c[0])] * (c[0] < 0 ? -0.5 : 0.5))
  tongue(F(C0[0] + d[0] * 1.6, C0[1] + d[1] * 1.6, c[3]), F(C0[0] + d[0] * c[1], C0[1] + d[1] * c[1], c[3] + 0.6), c[2],
         0.75, F(side[0], side[1], 0) + [0, 0, G], c = c[4] ? flameY : flameO);
// the fireball mass, merging down into the head top
color(flameO) hull() {
  translate(F(-1.2, 31.4, 1.0)) scale([2.6, 2.6, 2.4]) sphere(1, $fn = 14);
  translate(F(1.6, 31.6, 1.2)) scale([2.6, 2.6, 2.4]) sphere(1, $fn = 14);
  translate(F(0.2, 30.0, 0.8)) scale([2.4, 2.3, 1.6]) sphere(1, $fn = 12);
}

// ---------------------------------------------------------------- tail
// crimson tail feathers from the rump, down and out to its left behind
for (e = [[[2.5, 13.2], [11.0, 10.4], 0.95, 2.6], [[2.4, 12.0], [9.5, 8.6], 0.9, 3.2], [[2.0, 11.0], [7.5, 7.4], 0.8, 2.8]])
  blade(F(e[0][0], e[0][1], 2.4), F(e[1][0], e[1][1], e[3] + 1), e[2], 0.45, crimson);
blade(F(1.6, 12.4, 2.6), F(6.5, 8.6, 3.6), 0.7, 0.5, crimsonDk);
// the flame plume curling out and back under itself
streak([F(5.5, 11.6, 3.2), F(9.5, 12.2, 3.8), F(13.5, 12.3, 4.4), F(16.6, 11.3, 4.8), F(17.7, 9.3, 5.0),
        F(17.0, 7.5, 4.8), F(15.2, 6.6, 4.4), F(13.0, 6.9, 4.0)],
       [0.9, 1.1, 1.05, 0.95, 0.85, 0.75, 0.55, 0.2], 0.65);
streak([F(7.0, 10.3, 3.4), F(11.0, 10.6, 3.9), F(14.4, 10.0, 4.3), F(15.5, 8.6, 4.4), F(14.6, 7.7, 4.2), F(13.3, 7.9, 4.0)],
       [0.6, 0.75, 0.7, 0.55, 0.4, 0.15], 0.65);

// ---------------------------------------------------------------- flame wisps floating under the wings
streak([F(14.6, 17.3, 1.4), F(16.4, 19.5, 1.4), F(18.4, 21.8, 1.4), F(19.4, 23.6, 1.4)], [0.75, 0.9, 0.6, 0.15], 0.6);
streak([F(10.8, 17.4, 1.6), F(13.5, 16.2, 1.6), F(16.0, 14.9, 1.6), F(17.8, 14.5, 1.6)], [0.45, 0.7, 0.55, 0.12], 0.6);
streak([F(17.6, 17.4, 1.8), F(18.3, 15.5, 1.8), F(17.8, 13.4, 1.8), F(16.8, 12.6, 1.8)], [0.5, 0.65, 0.45, 0.12], 0.6);
streak([F(-10.8, 14.8, 1.4), F(-13.0, 15.9, 1.4), F(-15.0, 17.6, 1.4)], [0.7, 0.55, 0.12], 0.6);
streak([F(-12.6, 16.6, 1.6), F(-12.6, 14.2, 1.6), F(-11.2, 12.4, 1.6), F(-10.2, 12.0, 1.6)], [0.45, 0.65, 0.45, 0.12], 0.6);
streak([F(-9.0, 15.6, 1.2), F(-8.6, 13.2, 1.2), F(-7.4, 11.7, 1.2), F(-6.2, 11.1, 1.2)], [0.5, 0.65, 0.45, 0.12], 0.6);
