// Florasage: the final bloom of the Budwing line. An upright green dragon standing on its hind legs: a broad
// scaled chest with a pale belly, glowing green runes over the body, a brown bark ridge down the spine and on along
// the tail, a fierce dragon head with red slanted eyes, a brown mane and big branching antlers, two huge wings of broad
// green leaves set with orange sunflowers, a thick tail that sweeps out behind it to the right and curls into a coil,
// and a thin vine tail on its other side that rises into a big sunflower.
//
// Checklist (front sheet; the art stands on a sand patch, its near claws on sheet z 4.8 = scad z 0, --ground 4.8):
//   head      sheet x -5.5..2, z 25..32.5: skull, a short snout to the viewer's left (tip x -5.5, z 26..28.6),
//             mouth line z 26.3, forehead crest; a cross of glowing dots on the forehead (-3.6, 30.5)
//   eyes      two, red, slanted and angry, a peach highlight: near (-2, 28.3) about 1.6 wide, far a sliver at (-5.3, 28.5)
//   mane      brown jagged spines behind the head and down the back of the neck (near side x 0.5..2.5, z 24..30)
//   frill     a green spike from each side of the head (near (1.2..2.5, 30.2))
//   antlers   brown, big: near base (0, 31) -> tines up to (1, 38.5) (2.6, 40) (4.2, 38) (5.8, 39), out to (6.4, 35);
//             far base (-3, 31) -> tines up to (-7.5, 39.5) (-5.5, 40) (-3.5, 38)
//   body      upright torso x -7..3, z 9..25, pale belly with dark scale bands (x -6.5..-1.5), runes on the chest
//   arms      near: shoulder (2.5, 21) down to a red-clawed hand at (-0.7, 13.5); far: out to a hand at (-10, 12.5)
//   legs      big bent thighs; near foot (0, 5), far foot (-5, 6), red claws
//   wings     near: root (3, 22), eight broad leaves fanning to tips (8.8, 33) (12, 35) (17.2, 36) (18, 30) (16, 26)
//             (14.5, 22) (11.5, 18.7) (8, 18.5); sunflowers (11, 26.5) r 2.3, (8.5, 22.5) r 1.4, (6.3, 20.8) r 1.1;
//             far: x -19.5..-6, sunflowers (-12.5, 26.5) (-10.5, 23); dark leaves behind, dark midribs
//   tail      thick, from the hips out to the right: top edge (3, 15) -> (13, 17), curls down at x 18 and back under
//             (bottom z 8) into a coil with a hole at (11.5..15, 11..13); bark spikes on top, runes on its side
//   vine      thin green vine from the far hip along the ground to the left (-5, 8.5) -> (-14.5, 10), two small
//             leaves, a stem up into a big sunflower at (-15.3, 15.3) r 3.8 (also seen face-on from the back)
//   back      the bark ridge down the spine, runes on the back and tail, sunflowers on the wings' backs too
include <lib.scad>

skin = [0.37, 0.51, 0.28];
skinDk = [0.27, 0.39, 0.23];
belly = [0.46, 0.61, 0.32];
bellyLn = [0.3, 0.42, 0.24];
leaf = [0.37, 0.53, 0.28];
leafHi = [0.45, 0.62, 0.31];
leafDk = [0.22, 0.33, 0.2];
rib = [0.17, 0.26, 0.16];
bark = [0.6, 0.42, 0.3];
barkDk = [0.42, 0.28, 0.19];
antlerC = [0.56, 0.4, 0.28];
rune = [0.62, 0.92, 0.5, NOGLOW];
ink = [0.08, 0.1, 0.07];
claw = [0.82, 0.38, 0.22, NOGLOW];
petalO = [0.95, 0.6, 0.24, NOGLOW];
petalR = [0.8, 0.36, 0.14, NOGLOW];
seedC = [0.4, 0.24, 0.13];
seedDot = [0.7, 0.5, 0.3];
eyeR = [0.9, 0.2, 0.1, NOGLOW];
eyeS = [0.98, 0.45, 0.25, NOGLOW];

X0 = -1.5;   // the art's sheet x of scad x = 0, y = 0
G = 4.8;     // the art's foot line
function S(sx, sz, y) = let(x = (sx - X0 - 0.5 * y) / 0.866) [x, y, sz - G - 0.17 * (-0.5 * x + 0.866 * y)];
// Children authored in art sheet coordinates [x, z], extruded through the model along the view (for decals).
module artPrism() {
  pp(0) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, -0.176, 1, 0]]) translate([-X0, 0, -G]) rotate([90, 0, 0])
    linear_extrude(height = 120, center = true) children();
}

// A low-poly cone (spines, claws): base p, direction d, base radius r.
module cone(p, d, r, tip = 0.05, c, fn = 7) color(c) translate(p) rotate(_dir_rot(d)) cylinder(h = norm(d), r1 = r, r2 = tip, $fn = fn);

// ---- 2D rune glyphs (art units), centred at c.
module rune2d(c, w = 1.6, h = 2, t = 0.42) {
  translate([c[0] - w / 2, c[1] - h / 2]) {
    square([t, h]);
    square([w, t]);
    translate([w - t, 0]) square([t, h * 0.78]);
    translate([0, h - t]) square([w * 0.72, t]);
    translate([w * 0.36, h * 0.3]) square([t, h * 0.42]);
    translate([w * 0.36, h * 0.3]) square([w * 0.4, t]);
  }
}
module crossDots(c, s = 0.45) { for (d = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) translate(c + d * s * 1.6 - [s, s] / 2) square([s, s]); }
module runeF(c, s = 0.45) { translate(c - [s * 1.5, s * 2]) { square([s, s * 4]); translate([0, s * 3]) square([s * 3, s]); translate([0, s * 1.6]) square([s * 2.2, s]); } }

// ---- A sunflower facing +Z, `h` thick (an extruded star, both faces alike): orange petals, red-orange inner
// petals, a brown seed disc with a ring of pale seeds.
function star(n, r1, r2, a0 = 0) = [for (i = [0 : 2 * n - 1]) let(a = a0 + i * 180 / n, r = i % 2 == 0 ? r1 : r2) [r * cos(a), r * sin(a)]];
module sunflower(r, h) {
  color(petalO) linear_extrude(height = h, center = true) polygon(star(12, r, r * 0.76));
  color(petalR) linear_extrude(height = h + 0.12, center = true) polygon(star(12, r * 0.7, r * 0.55, 15));
  color(seedC) scale([r * 0.5, r * 0.5, h * 0.5 + 0.25]) sphere(1, $fn = 12);
  for (a = [0 : 45 : 359]) color(seedDot) rotate([0, 0, a]) translate([r * 0.3, 0, 0]) cube([r * 0.09, r * 0.09, h + 0.55], center = true);
}

// ---- Torso: hips, belly and chest, rising into the neck.
TOR = [[[5.0, 4.6, 4.6], [0, 1.5, 7.5]], [[4.8, 4.4, 5.0], [0, -0.4, 12.5]], [[4.2, 3.9, 3.9], [0, -1.2, 17]]];
module torso(g = 0) for (e = TOR) translate(e[1]) scale(e[0] + [g, g, g]) sphere(1, $fn = 22);
color(skin) torso();
limb([0, -1.2, 18.5], [0, -2.1, 22.2], 3.1, 2.6, skin);
// Pale scaled belly down the front, with dark scale bands across it.
BEL = [[3.3, 2.3, 7.6], [0, -2.9, 12.6]];
color(belly) translate(BEL[1]) scale(BEL[0]) sphere(1, $fn = 22);
color(bellyLn) intersection() {
  translate(BEL[1]) scale(BEL[0] + [0.1, 0.1, 0.1]) sphere(1, $fn = 22);
  union() for (z = [7.4 : 2.1 : 19]) translate([-5, -12, z]) cube([10, 8.3, 0.3]);
}

// ---- Head: skull, short snout and jaw, a raised forehead crest. HC is the skull's centre.
HC = [0, -2.2, 24.2];
color(skin) {
  translate(HC) scale([2.6, 3.1, 3.0]) sphere(1, $fn = 22);
  hull() { translate([0, -4.6, 23.3]) scale([1.9, 1.6, 1.6]) sphere(1, $fn = 16); translate([0, -7.6, 22.9]) scale([1.2, 1.1, 1.15]) sphere(1, $fn = 12); }
  translate([0, -4.3, 21.6]) scale([2.1, 2.6, 1.3]) sphere(1, $fn = 16);
  // forehead crest rising to a point over the brow
  hull() { translate([0, -3.4, 26.0]) scale([1.6, 1.4, 0.8]) sphere(1, $fn = 10); translate([0, -1.4, 27.9]) sphere(0.5, $fn = 8); }
}
// mouth line round the snout, nostrils
color(ink) intersection() {
  union() { hull() { translate([0, -4.6, 23.3]) scale([1.98, 1.68, 1.68]) sphere(1, $fn = 16); translate([0, -7.6, 22.9]) scale([1.28, 1.18, 1.23]) sphere(1, $fn = 12); }
    translate([0, -4.3, 21.6]) scale([2.18, 2.68, 1.38]) sphere(1, $fn = 16); }
  translate([-4, -12, 22.0]) cube([8, 7.6, 0.32]);
}
mirror_x() color(ink) translate([0.6, -8.55, 23.5]) scale([0.3, 0.25, 0.22]) sphere(1, $fn = 8);
// Eyes: red, slanted, angry lids and a hard brow, a small highlight.
mirror_x() {
  eye([1.6, -4.55, 24.15], 1.1, iris = eyeR, pupil = ink, sclera = eyeS, yaw = 26, flat = 0.5,
      lid = 0.3, lid_tilt = 26, lid_c = skin, slit = 0.35, shine = true);
  color(skin) hull() {
    translate([2.3, -4.0, 25.35]) scale([0.7, 0.8, 0.4]) sphere(1, $fn = 10);
    translate([0.75, -5.0, 24.85]) scale([0.55, 0.7, 0.35]) sphere(1, $fn = 10);
  }
  // green frill spike out of the side of the head
  spike([2.4, -1.2, 25.1], [2.0, 1.3, 0.5], 0.75, 0.1, skin);
}
// Glowing runes on the forehead.
color(rune) intersection() {
  union() { translate(HC) scale([3.05, 3.35, 3.15]) sphere(1, $fn = 22); hull() { translate([0, -3.4, 26.0]) scale([1.75, 1.55, 0.95]) sphere(1, $fn = 10); translate([0, -1.4, 27.9]) sphere(0.65, $fn = 8); } }
  artPrism() { crossDots([-3.5, 30.6], 0.5); translate([-4.9, 29.0]) square([0.5, 1.5]); }
  translate([-10, -20, 18]) cube([20, 18, 20]);
}

// ---- Mane and spine: brown jagged spines behind the head, down the back and on along the tail.
MANE = [[[0, -0.2, 27.2], [0, 1.5, 0.6]], [[1.3, 0.2, 25.8], [0.9, 1.6, 0.0]], [[-1.3, 0.2, 25.8], [-0.9, 1.6, 0.0]],
        [[1.6, 0.3, 23.8], [0.9, 1.5, -0.5]], [[-1.6, 0.3, 23.8], [-0.9, 1.5, -0.5]], [[0, 0.4, 24.6], [0, 1.9, 0.2]],
        [[0, 0.6, 22.2], [0, 1.8, 0.1]]];
for (m = MANE) cone(m[0], m[1], 0.8, 0.08, barkDk);
SPINE = [[0, 1.6, 20.2], [0, 2.6, 17.4], [0, 3.6, 14.6], [0, 4.6, 11.6], [0, 5.5, 8.8], [0, 5.8, 6.2]];
chain(SPINE, [0.7, 0.7, 0.7, 0.7, 0.7, 0.6], bark);
for (i = [0 : len(SPINE) - 1]) cone(SPINE[i], [0, 1.4, 0.7], 0.75, 0.08, i % 2 == 0 ? barkDk : bark);

// ---- Antlers: branching beams in their own plane (u out, v up), swept back.
ANT = [[[0, 0], [1.0, 2.2], 0.75, 0.68], [[1.0, 2.2], [2.6, 3.6], 0.68, 0.6], [[2.6, 3.6], [5.0, 4.4], 0.6, 0.5],
       [[5.0, 4.4], [6.0, 7.6], 0.5, 0.36],
       [[1.0, 2.2], [0.6, 7.4], 0.5, 0.32], [[2.6, 3.6], [2.4, 9.0], 0.5, 0.32], [[3.9, 4.1], [3.9, 7.4], 0.42, 0.3],
       [[5.0, 4.4], [6.8, 4.0], 0.42, 0.3], [[0.8, 5.0], [-0.6, 6.4], 0.36, 0.26], [[2.5, 6.8], [3.4, 8.0], 0.34, 0.26]];
mirror_x() translate([1.3, -1.6, 26.4]) rotate([0, 0, 18]) rotate([0, 12, 0])
  for (a = ANT) limb([a[0][0] * 1.4, 0, a[0][1] * 0.9], [a[1][0] * 1.4, 0, a[1][1] * 0.9], a[2], a[3], antlerC, $fn = 8);

// ---- Arms: the near one (+X) hangs at its side with the hand on the thigh, the far one reaches out.
module claws3(p, d, n) for (k = [-1, 0, 1]) cone(p + n * k * 0.45, d + n * k * 0.2, 0.28, 0.04, claw);
limb([4.0, -0.8, 16.6], [5.0, -1.6, 12.6], 1.45, 1.2, skin);
limb([5.0, -1.6, 12.6], [2.8, -4.2, 9.6], 1.2, 0.95, skin);
claws3([2.6, -4.9, 9.0], [-0.1, -0.5, -0.8], [0.6, 0, 0]);
limb([-4.0, -0.8, 16.6], [-6.8, -1.2, 12.2], 1.45, 1.2, skin);
limb([-6.8, -1.2, 12.2], [-8.6, -3.3, 9.4], 1.2, 0.95, skin);
claws3([-8.9, -3.9, 8.7], [-0.1, -0.4, -0.9], [0.6, 0, 0]);

// ---- Hind legs: big bent thighs, shins down to long clawed feet.
mirror_x() {
  color(skin) translate([4.1, 0.0, 6.6]) scale([2.9, 3.8, 4.0]) sphere(1, $fn = 20);
  limb([4.3, -1.6, 4.2], [4.0, -0.6, 1.3], 1.7, 1.25, skin);
  color(skin) hull() { translate([4.0, -0.4, 0.95]) scale([1.3, 1.4, 0.95]) sphere(1, $fn = 12); translate([3.6, -3.4, 0.8]) scale([1.5, 1.2, 0.8]) sphere(1, $fn = 12); }
  claws3([3.6, -4.4, 0.7], [0, -0.9, -0.5], [0.65, 0, 0]);
}

// ---- Main tail: out behind to the right, curling down and back under into a coil (a vertical spiral).
TAIL = [S(0.5, 10.4, 3.0), S(4.5, 11.6, 4.5), S(9, 13.0, 5.5), S(13, 13.7, 6), S(16, 13.2, 6), S(17.1, 11.4, 6),
        S(16.2, 9.6, 6), S(13.7, 9.0, 6), S(11.2, 9.6, 6), S(10.1, 11.0, 6), S(10.9, 12.3, 6)];
TAIL_R = [3.1, 2.7, 2.5, 2.3, 2.1, 1.9, 1.7, 1.5, 1.3, 1.0, 0.7];
chain(TAIL, TAIL_R, skin, $fn = 14);
// darker underside of the coil
for (i = [0 : len(TAIL) - 2]) let(d = TAIL[i + 1] - TAIL[i], r = (TAIL_R[i] + TAIL_R[i + 1]) / 2, m = (TAIL[i] + TAIL[i + 1]) / 2)
  if (i <= 4) color(skinDk) translate(m + [0, 0, -r * 0.35]) rotate(_dir_rot(d)) scale([r * 0.85, r * 0.85, norm(d) * 0.55]) sphere(1, $fn = 10);
// bark spikes along the top of the tail
for (i = [1 : 5]) let(p = TAIL[i], r = TAIL_R[i]) cone(p + [0, 0.3, r * 0.75], i < 4 ? [0.1, 0.4, 1.1] : [1.0, 0, 0.5], 0.75, 0.08, i % 2 == 0 ? bark : barkDk);
for (i = [1 : 4]) let(p = (TAIL[i] + TAIL[i + 1]) / 2, r = (TAIL_R[i] + TAIL_R[i + 1]) / 2) cone(p + [0, 0.3, r * 0.8], [0, 0.4, 0.8], 0.6, 0.08, barkDk);
// glowing runes on the tail's front side
color(rune) intersection() {
  union() for (i = [0 : 5]) limb(TAIL[i], TAIL[i + 1], TAIL_R[i] + 0.15, TAIL_R[i + 1] + 0.15, rune, $fn = 14);
  artPrism() { runeF([7.6, 12.0], 0.55); translate([8.4, 14.6]) square([1.6, 0.55]); translate([11.0, 15.2]) square([1.5, 0.55]);
    crossDots([13.8, 14.6], 0.5); translate([15.8, 13.4]) square([0.6, 0.7]); }
  translate([0, -10, 0]) cube([30, 14.5, 20]);
}

// ---- Vine tail: from the far hip along the ground to the left, two small leaves, a stem up into a big sunflower.
VINE = [[-2.2, 4.2, 3.0], S(-6, 8.0, 3), S(-10, 8.4, 2.5), S(-13, 9.2, 2), S(-14.9, 10.6, 2), S(-15.4, 12.4, 2), S(-15.3, 14.6, 2)];
chain(VINE, [1.8, 1.4, 1.15, 0.95, 0.75, 0.6, 0.5], skin);
for (l = [[S(-15.0, 10.4, 2), [-2.6, -0.6, -0.3], 0], [S(-13.6, 9.6, 2), [1.8, -1.1, 1.3], 1]])
  color(l[2] == 0 ? leafHi : leaf) hull() { translate(l[0]) sphere(0.4, $fn = 6); translate(l[0] + l[1] * 0.55) scale([0.85, 0.85, 0.35]) sphere(1, $fn = 8); translate(l[0] + l[1]) sphere(0.15, $fn = 4); }
translate(S(-15.3, 15.3, 1.6)) rotate([0, 0, 30]) rotate([90, 0, 0]) sunflower(3.9, 0.8);

// Glowing runes on the chest, the near shoulder and the near thigh.
color(rune) intersection() {
  union() { torso(0.15); translate([4.1, 0.0, 6.6]) scale([3.05, 3.95, 4.15]) sphere(1, $fn = 20);
    limb([4.0, -0.8, 16.6], [5.0, -1.6, 12.6], 1.6, 1.35, rune); }
  artPrism() { rune2d([-4.4, 20.0], 2.0, 2.5, 0.5); crossDots([0.3, 20.4], 0.55); runeF([1.2, 11.4], 0.55);
    crossDots([-3.2, 14.0], 0.45); translate([3.3, 21.4]) square([0.55, 1.8]); translate([-1.8, 24.4]) square([1.4, 0.5]);
    runeF([2.4, 16.4], 0.45); }
  translate([-12, -12, 0]) cube([24, 11.8, 24]);
}
// Runes on the back (seen in the back art): small glowing marks between the shoulders and over the hips.
for (p = [[1.6, 3.9, 13.5], [-2.2, 5.0, 10.2], [2.8, 5.6, 7.4], [-1.2, 3.0, 16.6], [3.4, 2.4, 17.2]])
  let(n = [p[0] / 5, (p[1] - 0.5) / 4.6, 0]) color(rune) translate(p) rotate(_dir_rot(n)) scale([0.55, 0.4, 0.18]) sphere(1, $fn = 6);

// ---- Wings: eight broad leaves each, fanned in the wing's plane (u out, v up) from the shoulder, a darker layer of
// leaves and the web behind them, dark midribs, and sunflowers set through them (seen from both sides).
// [root u, v], [tip u, v], half width, depth offset
LEAVES = [
  [[2.4, 2.4], [9.2, 9.0], 2.0, 0.3],
  [[3.2, 2.2], [13.4, 11.4], 2.4, -0.2],
  [[4.0, 1.6], [18.4, 13.0], 2.5, 0.25],
  [[4.6, 0.8], [19.0, 8.5], 2.5, -0.25],
  [[4.6, -0.2], [18.0, 3.5], 2.4, 0.25],
  [[4.2, -1.0], [16.0, 0.3], 2.3, -0.2],
  [[3.4, -1.6], [12.5, -2.6], 2.1, 0.25],
  [[2.4, -1.6], [7.2, -3.4], 1.8, -0.15],
];
function lprof(s) = pow(sin(180 * pow(s, 0.8)), 0.8);
function lpt(f, s, k, w) = let(r = f[0], t = f[1], d = t - r, n = [-d[1], d[0]] / norm(d)) r + d * s + n * w * lprof(s) * k;
function lpoly(f, w) = concat([for (i = [0 : 9]) lpt(f, i / 9, 1, w)], [for (i = [8 : -1 : 1]) lpt(f, i / 9, -1, w)]);
function ribPoly(f) = [lpt(f, 0.05, 1, 0.3), lpt(f, 0.9, 1, 0.15), lpt(f, 0.9, -1, 0.15), lpt(f, 0.05, -1, 0.3)];
function webPoly() = concat([[0.6, 0.6]], [for (k = [0 : len(LEAVES) - 1]) lpt(LEAVES[k], 0.62, 0, 0)], [[1.2, -1.0]]);
WFLOWERS = [[[10.2, 4.0], 2.6], [[7.0, 0.0], 1.6], [[4.4, -1.8], 1.3]];
WROOT = [3.0, 2.6, 17.4];
WSWEEP = 0;
module wing() {
  $fa = 24; $fs = 2;
  // shoulder: a thick green root joining the wing to the back
  limb([-2.6, 0, -1.2], [2.2, 0, 0.4], 1.6, 1.3, skin);
  // the web and a darker layer of leaves behind, offset half a leaf, so the fan reads as one dense mass
  slab(webPoly(), 1.1, leafDk, inset = 0.5, grow = 0.2);
  for (k = [0 : len(LEAVES) - 2]) let(a = LEAVES[k], b = LEAVES[k + 1], f = [(a[0] + b[0]) / 2, (a[1] + b[1]) * 0.47])
    slab(lpoly(f, 1.9), 1.1, leafDk, inset = 0.5, grow = 0.2);
  for (k = [0 : len(LEAVES) - 1]) let(f = LEAVES[k]) translate([0, f[3], 0]) {
    slab(lpoly(f, f[2]), 1.5, k % 2 == 0 ? leaf : leafHi, inset = 0.6, grow = 0.2);
    slab(ribPoly(f), 1.9, rib, inset = 0.05, grow = 0.05);
  }
  for (w = WFLOWERS) translate([w[0][0], 0, w[0][1]]) rotate([90, 0, 0]) sunflower(w[1], 2.4);
}
mirror_x() translate(WROOT) rotate([0, 0, WSWEEP]) wing();
