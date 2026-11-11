// Venobulb: Snapling grown into a hulking dark-green flytrap brute on four splayed legs. Its whole front is one huge
// gaping flytrap maw (a dark hood of an upper jaw, long cream fangs all round a mauve gum line, a dark throat, a fat
// green tongue, lime venom drooling off the teeth). A cluster of small open flytraps in a rosette of pointed leaves
// grows on each shoulder; glowing purple veins crack over the whole hide; a long scaled tail studded with purple thorns
// sweeps round the near side and curls forward along the ground.
//
// Checklist (front sheet, sheet z; the feet stand on sheet z ~6, so scad z = sheet z - 6):
//   maw: opening x -14..2.4, z 13..28.4 (centre -5.5, 21), seen almost face-on. Upper fangs ~4 long (z 24..28.4),
//     lower ~2.5 (z 14.8..17.4). Mauve gum band inside the rim, dark teal mouth, black throat (-5, 23), green tongue
//     (-9..-1, 16.6..22). Hood (upper jaw back) arches over it to z 33. Lime drool strings off the teeth and the lip.
//   No eyes in the art.
//   traps: two clusters. Far one over the hood: up trap (-10, 36), side trap facing left (-14, 31). Near one on the
//     shoulder: up trap (5.5, 35.5), side trap facing right (9.5, 31), a leaf hanging in front (5, 29). The back shows
//     the near cluster as a closed bulb in leaves and the far one with three traps facing out. Symmetric pair at
//     scad (+-9.5, -4).
//   body: hump x 2..17, z 13..33, knobbly haunch at (12..16.5, 19..25); lighter round scale patches on the thigh and
//     shoulder; purple veins everywhere (body, legs, hood).
//   legs: far front splayed forward-out, foot x -22..-12 z 6..9 (big, four claws); near front tucked under the maw,
//     foot x -4..2 z 7.7..9.7, claws forward; near hind thigh (7.5..13, 11..18), foot (10..15.5, 7..9.5); far hind hidden.
//   tail: off the rump, down the near side (x 18..21, z 16..6), then along the ground forward to the tip (5, 2.5);
//     purple thorn studs along its top and bottom edges.
//   Not modelled: floating spores and droplets, the grey ground shadow by the tail.
include <lib.scad>
$fa = 15;
$fs = 1.45;

skin = [0.2, 0.38, 0.26];
skinDark = [0.14, 0.28, 0.22];
skinHi = [0.3, 0.55, 0.34];
mouthIn = [0.1, 0.16, 0.18];
throat = [0.03, 0.05, 0.06];
gum = [0.45, 0.25, 0.38, NOGLOW];
fang = [0.92, 0.86, 0.67];
tongue = [0.24, 0.46, 0.3];
drool = [0.66, 0.84, 0.28, NOGLOW];
vein = [0.5, 0.2, 0.7, GLOW];
stud = [0.45, 0.24, 0.58, NOGLOW];
leafC = [0.31, 0.53, 0.17];
trapC = [0.5, 0.74, 0.23, NOGLOW];
trapIn = [0.32, 0.16, 0.27];

function rotX(a, v) = [v[0], v[1] * cos(a) - v[2] * sin(a), v[1] * sin(a) + v[2] * cos(a)];
function rotZ(a, v) = [v[0] * cos(a) - v[1] * sin(a), v[0] * sin(a) + v[1] * cos(a), v[2]];

// An ellipsoid with its own (low) facet count.
module el(r, p, c, fn = 16) { color(c) translate(p) scale(r) sphere(1, $fn = fn); }

// A cheap cone (teeth, claws, thorns): base p, direction d, base radius r.
module cone(p, d, r, c, fn = 6) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = l, r1 = r, r2 = 0.04, $fn = fn);
}

// ---- The maw: two deep bowl jaws (half ellipsoid shells, Snapling's trap jaws) hinged at H, gaping wide.
H = [0, -7, 14.8];
UA = 58;           // upper jaw raised
LA = 40;           // lower jaw dropped
YAW = 4;           // the maw turned a little towards the viewer (+X)
RU = [9.4, 5.8, 8.6];
RL = [8.8, 5.6, 5.2];
F = 0.85;          // the bowl's centre sits F * ry in front of the hinge
K = 0.84;          // inner shell scale
LIP = 1.4;         // the lip band's height above the rim

// One jaw, opening downwards onto z = 0 (the rim), bowl up; hinge at the origin, the jaw reaching along -Y.
// `lipC` is the outer lip band, `tl` the fang length, `inward` how much the fangs lean across the mouth.
module jaw(r, nT, tl, lipC, inward = 0.4, fn = 26) {
  c = [0, -F * r[1], 0];
  module outer() translate(c) scale(r) sphere(1, $fn = fn);
  module inner() translate(c) scale(r * K) sphere(1, $fn = fn * 0.8);
  color(skin) difference() {
    outer();
    inner();
    translate([0, 0, -50 + LIP]) cube(100, center = true);
  }
  color(lipC) intersection() {
    difference() { outer(); inner(); }
    translate([-20, -40, 0]) cube([40, 60, LIP]);
  }
  // mauve gum band just inside the rim, then the dark lining
  color(gum) intersection() {
    difference() { inner(); translate(c) scale(r * K - [0.4, 0.4, 0.4]) sphere(1, $fn = fn * 0.8); }
    translate([-20, -40, 0]) cube([40, 60, 1.2]);
  }
  color(mouthIn) difference() {
    inner();
    translate(c) scale(r * K - [0.4, 0.4, 0.4]) sphere(1, $fn = fn * 0.8);
    translate([0, 0, -50 + 1.2]) cube(100, center = true);
  }
  // fangs round the rim (not behind the hinge), leaning across the mouth
  for (i = [0 : nT - 1]) let(t = -228 + i * 276 / (nT - 1), q = (1 + K) / 2,
                              p = c + [q * r[0] * cos(t), q * r[1] * sin(t), 0.1],
                              big = 0.75 + 0.45 * (i % 2) + 0.2 * sin(i * 77))
    cone(p, [-inward * cos(t), -inward * sin(t) + 0.25, -1] * tl * big, 0.62 * big, fang);
}
// world point on a jaw's rim: angle t round the rim, `upper` or lower jaw
function rimU(t) = H + rotZ(YAW, rotX(-UA, [0, -F * RU[1], 0] + [0.95 * RU[0] * cos(t), 0.95 * RU[1] * sin(t), 0]));
function rimL(t) = H + rotZ(YAW, rotX(LA, [0, -F * RL[1], 0] + [0.95 * RL[0] * cos(t), 0.95 * RL[1] * sin(t), 0]));

translate(H) rotate([0, 0, YAW]) {
  rotate([-UA, 0, 0]) jaw(RU, 13, 3.6, skin, 0.35);
  rotate([LA, 0, 0]) mirror([0, 0, 1]) jaw(RL, 11, 2.6, skinHi, 0.3);
  // the back of the mouth: a dark wall between the jaws, the black throat in it
  el([7.4, 2.4, 6.6], [0, 0.6, 0.6], mouthIn, 18);
  el([3.6, 1.2, 3.4], [0, -1.4, 1.6], throat, 14);
  // the fat tongue lolling out over the lower jaw
  color(tongue) hull() {
    translate([0, -2.4, -0.2]) scale([3.2, 2.2, 2]) sphere(1, $fn = 16);
    translate([0, -6.4, -2.4]) scale([3.3, 2.6, 1.8]) sphere(1, $fn = 16);
  }
  color(skinHi) translate([0, -5.4, -1.7]) scale([1.4, 2.6, 0.9]) sphere(1, $fn = 10);
}
// venom strings off the upper fangs and over the lower lip
for (d = [[-150, 7], [-115, 5.5], [-80, 8], [-50, 6], [-20, 4.5]]) let(p = rimU(d[0]) + [0, 0, -1.2])
  chain([p, p + [0, 0, -d[1] * 0.6], p + [0, -0.2, -d[1]]], [0.32, 0.24, 0.34], drool);
for (d = [[-140, 4], [-95, 5.5], [-55, 3.5]]) let(p = rimL(d[0]) + [0, -0.4, 0.2])
  chain([p, p + [0, -0.3, -d[1] * 0.6], p + [0, -0.4, -d[1]]], [0.34, 0.24, 0.36], drool);

// ---- Body: a hunched brute, highest at the shoulders, the rump lower; knobbly haunches.
E1 = [[11.2, 9.5, 13], [0, 2.5, 15]];   // shoulders
E2 = [[10.2, 9, 9.5], [0, 10.5, 12.5]];       // rump
E3 = [[8.5, 8, 4.5], [0, 4, 10.5]];        // belly
blob([E1, E2, E3], skin);
mirror_x() {
  el([2.6, 3, 2.6], [9.2, 9.5, 17.4], skin, 14);
  el([2, 2.2, 1.9], [10, 6.6, 18.6], skin, 12);
  el([1.9, 2, 1.8], [9.8, 12.4, 16.2], skin, 12);
}

// A flush patch (a flattened ellipsoid half sunk into the surface) on ellipsoid e at azimuth az / elevation el.
function onE(e, az, el, k = 1) = let(r = e[0]) e[1] + k * [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)];
module patchOn(e, az, el, a, b, c, spin = 0) {
  r = e[0];
  d = [cos(el) * cos(az), cos(el) * sin(az), sin(el)];
  n = [d[0] / r[0], d[1] / r[1], d[2] / r[2]];
  color(c) translate(onE(e, az, el) - n / norm(n) * 0.2) rotate(_dir_rot(n)) rotate([0, 0, spin]) scale([a, b, 0.4]) sphere(1, $fn = 10);
}
// lighter scale patches (the art's round lighter plates on the shoulders and haunches)
mirror_x() {
  patchOn(E1, -30, 15, 3, 2.4, skinHi, 20);
  patchOn(E1, 10, 40, 2.4, 2, skinHi, 50);
  patchOn(E2, 30, 25, 2.8, 2.2, skinHi, 10);
  patchOn(E2, 70, 5, 2.2, 1.8, skinHi, 60);
}

// ---- Veins: thin glowing purple cracks branching over the hide (both flanks, the back, the rump).
module veinWalk(e, az, el, daz, del, n, wig, k = 1.0) {
  pts = [for (i = [0 : n]) onE(e, az + daz * i + wig * sin(i * 97 + az), el + del * i + wig * 0.6 * cos(i * 71 + el), k)];
  chain(pts, [for (i = [0 : n]) 0.5 - 0.22 * i / n], vein);
}
mirror_x() {
  // cracks from near the spine down the flank, each with a side branch
  for (v = [[-78, 50, 6, -14], [-48, 58, -5, -15], [-18, 55, 7, -15], [12, 58, -6, -15], [42, 55, 6, -14]]) {
    veinWalk(E1, v[0], v[1], v[2], v[3], 3, 6);
    veinWalk(E1, v[0] + v[2] * 1.5, v[1] + v[3] * 1.5, v[2] < 0 ? 12 : -12, -9, 2, 4);
  }
  for (v = [[68, 50, 6, -14], [98, 55, -6, -15], [128, 45, 6, -13], [84, 12, 8, -10]]) {
    veinWalk(E2, v[0], v[1], v[2], v[3], 3, 6);
    veinWalk(E2, v[0] + v[2] * 1.5, v[1] + v[3] * 1.5, v[2] < 0 ? 12 : -12, -9, 2, 4);
  }
  // down the front shoulder and the hind thigh
  veinWalk(SH, -30, 45, 12, -22, 3, 6, 1.02);
  veinWalk(TH, -40, 45, 8, -22, 3, 6, 1.02);
  veinWalk(TH, 10, 50, -10, -20, 3, 6, 1.02);
}
// down the spine
veinWalk(E1, 90, 80, 0, -12, 2, 10);
veinWalk(E2, 90, 75, 0, -10, 3, 10);

// ---- Shoulder flytraps: a rosette of pointed leaves and three small open traps on short stalks.
module leaf(len, w, t) {
  color(leafC) hull() {
    sphere(t * 0.5, $fn = 6);
    translate([0, 0, len * 0.45]) scale([w / 2, t / 2, len * 0.35]) sphere(1, $fn = 9);
    translate([0, 0, len]) sphere(0.15, $fn = 4);
  }
}
module trapJaw(r, nT) {
  c = [0, -F * r[1], 0];
  color(trapC) difference() {
    translate(c) scale(r) sphere(1, $fn = 9);
    translate(c) scale(r * 0.8) sphere(1, $fn = 8);
    translate([0, 0, -50]) cube(100, center = true);
  }
  color(trapIn) difference() {
    translate(c) scale(r * 0.8) sphere(1, $fn = 8);
    translate(c) scale(r * 0.8 - [0.3, 0.3, 0.3]) sphere(1, $fn = 8);
    translate([0, 0, -50]) cube(100, center = true);
  }
  for (i = [0 : nT - 1]) let(t = -215 + i * 250 / (nT - 1), p = c + [0.9 * r[0] * cos(t), 0.9 * r[1] * sin(t), 0])
    cone(p, [-0.2 * cos(t), -0.2 * sin(t), -1] * 1.1, 0.32, fang, 5);
}
// one trap: mouth facing -Y before it is turned (pitch < 0 lifts it to face up), on a stalk from `base`
module trap(p, yaw, pitch, s = 1) {
  translate(p) rotate([0, 0, yaw]) rotate([pitch, 0, 0]) scale(s) {
    rotate([-36, 0, 0]) trapJaw([2.5, 2.3, 1.9], 6);
    rotate([36, 0, 0]) mirror([0, 0, 1]) trapJaw([2.5, 2.3, 1.9], 6);
    color(trapIn) translate([0, 0.3, 0]) scale([1.6, 0.8, 1.4]) sphere(1, $fn = 8);
    color(leafC) translate([0, 1.8, 0]) rotate([-90, 0, 0]) cylinder(h = 3, r1 = 1.1, r2 = 0.8, $fn = 8);
  }
}
SP = [9, -3.5, 23.6];   // cluster centre (the +X one; mirrored)
mirror_x() {
  el([4.4, 4.4, 2.6], SP + [0, 0, -0.6], skin, 16);
  for (l = [0 : 6]) let(a = l * 360 / 7 + 10)
    translate(SP + [1.6 * cos(a), 1.6 * sin(a), 0.4]) rotate([0, 0, a - 90]) rotate([0, 48, 0]) rotate([0, 0, 90]) leaf(7.6, 3, 0.8);
  trap(SP + [-0.4, -0.8, 6.2], 15, -62, 1.3);
  trap(SP + [4.2, 0.6, 2.6], 100, -12, 1.2);
  trap(SP + [-0.8, 4.2, 3.6], 200, -30, 1.1);
  // a leaf hanging down over the front of the shoulder
  translate(SP + [-1.2, -3.4, 0.4]) rotate([0, 0, 10]) rotate([200, 0, 0]) leaf(4.4, 2.4, 0.7);
}

// ---- Legs: thick and splayed, big feet with clawed toes.
module foot(p, yaw, w = 1) {
  translate(p) rotate([0, 0, yaw]) {
    color(skin) scale([2.8 * w, 2.8, 1.3]) sphere(1, $fn = 12);
    for (a = [-45, -15, 15, 45]) let(e = [sin(a) * 3.6 * w, -cos(a) * 3.4 - 0.4, -0.3]) {
      limb([0, -0.6, 0.2], e, 1.0, 0.65, skin);
      cone(e, [sin(a) * 1.2, -cos(a) * 1.2, -0.3], 0.5, skinDark, 6);
    }
  }
}
SH = [[4.4, 4.6, 5], [9, -2, 11.5]];   // front shoulder (both)
TH = [[4.6, 6, 5.4], [8.4, 10, 8.6]];  // hind thigh (both)
mirror_x() {
  el(SH[0], SH[1], skin, 20);
  el(TH[0], TH[1], skin, 20);
  patchOn(TH, -10, 20, 2.8, 2.2, skinHi, 70);
  limb([10, 10, 6.6], [10.8, 9, 2], 3, 2.4, skin);
  foot([11.2, 7.6, 1.3], -8);
}
// near (+X) front leg tucked under the maw, the claws reaching forward
limb([10, -3, 10.5], [10.2, -8, 6.2], 3.4, 2.8, skin);
limb([10.2, -8, 6.2], [8.2, -11.2, 2], 2.8, 2.3, skin);
foot([7.6, -12.6, 1.3], 20);
// far (-X) front leg splayed forward and out
limb([-10, -3, 12], [-15.6, -5.4, 9], 3.8, 3.1, skin);
limb([-15.6, -5.4, 9], [-16, -8.6, 2], 3.1, 2.5, skin);
foot([-16, -9.8, 1.3], -45, 1.15);
// veins down the legs
module legVein(pts) chain(pts, [for (i = [0 : len(pts) - 1]) 0.4 - 0.15 * i / (len(pts) - 1)], vein);
legVein([[-12, -5.8, 13.4], [-15.4, -7.6, 10.4], [-17.6, -8.4, 7.4], [-18.4, -9.6, 3.4]]);
legVein([[-12.4, -6.8, 10.6], [-15, -9.2, 7.2], [-16.4, -11.4, 3.4]]);
legVein([[12.6, -4.6, 10.6], [12.6, -8, 7], [11, -11, 3.4]]);
mirror_x() {
  legVein([[12.6, 6.6, 12], [12.8, 9.6, 9], [13, 8.6, 5.4], [12.8, 9.2, 3]]);
  legVein([[11, 4.6, 7.6], [12.4, 6.8, 5.2], [13.4, 10.6, 6.6]]);
}

// ---- Tail: off the rump, round the near side and forward along the ground, purple thorn studs along it.
TAIL = [[0, 17, 10], [6, 20, 7.8], [12.4, 17.4, 5], [16.6, 11, 3], [18, 3.6, 2.2], [16.6, -3.4, 1.8], [14, -8, 1.3], [11.2, -10.6, 0.8]];
TAIL_R = [3.8, 3.3, 2.9, 2.5, 2.2, 1.8, 1.3, 0.5];
chain(TAIL, TAIL_R, skin);
for (i = [0 : len(TAIL) - 2], f = [0.25, 0.75]) let(p = TAIL[i] * (1 - f) + TAIL[i + 1] * f, r = TAIL_R[i] * (1 - f) + TAIL_R[i + 1] * f,
                                                   d = TAIL[i + 1] - TAIL[i], o = [d[1], -d[0], 0] / norm([d[1], -d[0], 0]))
  if (r > 0.7) {
    cone(p + [0, 0, r * 0.8], [0, 0, 0.9 + 0.3 * r], 0.32 * r + 0.15, stud);
    cone(p + o * r * 0.8 + [0, 0, r * 0.2], o * (0.8 + 0.3 * r) + [0, 0, 0.2], 0.3 * r + 0.15, stud);
    cone(p - o * r * 0.8 + [0, 0, r * 0.2], -o * (0.8 + 0.3 * r) + [0, 0, 0.2], 0.3 * r + 0.15, stud);
  }
