// Abysspark Tenjin: the ascended Abysspark, the same long anglerfish-shark side-on, shorter and deeper, in navy armour
// veined with glowing yellow lightning, gold spikes down the back, pale jade feather fins edged in gold, a pearl grin,
// a gold halo arch with a gem over the head and a sun-gold lure in a gold ring.
//
// Checklist (front sheet, 43.3 x 40 units; sheet x, z):
//   body plan  snout (-16.8, 18.5) blunt and round, head top (-12, 27.5), deepest at x -7..-1 (z 10..31), the tail
//              root at x 11 (z 15..21); built like Abysspark in the fish frame F() (YAW -35, u across, v along)
//   face       a glowing white almond eye at (-10.2, 21.6) under a navy brow; a closed grin, pearl beads along the
//              lower lip (-15.5, 15) .. (-4, 18.5) and a short row on the upper lip (-9 .. -4, 17.5 .. 19)
//   lure       a navy stalk from the head (-7.9, 27) up to (-13, 33.2) and down to a glowing gold bulb (-18.6, 27.1)
//              r 2.6 in a gold ring (eight small rays on the back art)
//   halo       a gold arch in the midplane over the head, x -12.4 .. -2.6, top z 34.2 with a grey-green gem
//   fins       two big swept jade feather fins on the back (tips (5.9, 40), (17.8, 39)) with gold leading edges; a big
//              navy-and-jade pectoral sweeping down and back to (21, 2.6) with gold rays; throat fins with gold spikes and
//              a jade beard hanging to (-12.5, 1); a forked jade tail with a yellow stripe, tip (21.4, 24.4)
//   markings   yellow lightning and teal streaks on the flanks; gold spikes in two rows down the back
//   back       the same parts from behind (the back art curls the tail, the front wins)
include <lib.scad>

YAW = -35;

navy = [0.11, 0.22, 0.42];
jade = [0.39, 0.82, 0.74];
paleJade = [0.73, 0.95, 0.83];
gold = [0.8, 0.64, 0.3, NOGLOW];
yellow = [0.93, 0.94, 0.37, NOGLOW];
teal = [0.25, 0.8, 0.72, NOGLOW];
pearl = [0.95, 0.94, 0.78];
throat = [0.03, 0.04, 0.09];
gem = [0.55, 0.62, 0.45];
eyeGlow = [0.97, 1, 0.95, GLOW];
bulb = [0.98, 0.9, 0.5, GLOW];

// The fish's own frame (as Abysspark): sheet point (sx, zs) at depth u -> [u, v, z] in F().
function L(sx, zs, u = 0) = let(v = (sx - 0.42262 * u) / 0.90631) [u, v, zs + 0.1574 * u - 0.0734 * v];
module F() rotate([0, 0, YAW]) children();
module side(u0 = 0) multmatrix([[0, -1, 0, u0], [1.10338, 0, 0, -0.46631 * u0], [-0.08099, 0, 1, 0.19163 * u0], [0, 0, 0, 1]]) children();
module both() { children(); mirror([1, 0, 0]) children(); }
module hinged(u0, zh, a) F() both() translate([u0, 0, zh]) rotate([0, a, 0]) translate([-u0, 0, -zh]) side(u0) children();
// an outline's inner part (shrunk by d), a little proud of a plate t thick: the pale or dark core of a fin
module core(pts, t, d) rotate([90, 0, 0]) linear_extrude(height = t, center = true) offset(delta = -d) polygon(pts);

// ---- body: sections [sheet x, sheet z, half-width, half-length, half-height], hulled pairwise
BODY = [[-16.4, 19.3, 2.4, 1.2, 2.4], [-12.8, 22.8, 4.4, 2.5, 4.8], [-7.5, 21, 6, 3, 9.5], [-1.5, 20, 6.4, 3, 10],
        [4, 19, 5.6, 2.6, 8.5], [8, 18.2, 3.8, 2, 5], [11, 18, 2.2, 1.4, 2.6], [13, 18.3, 1.4, 1, 1.8]];
JAW = [[-15, 14.8, 2.4, 1.2, 1.4], [-9, 13.8, 4.6, 2.2, 2.4]];
module sec(s, g = 0) translate(L(s[0], s[1])) scale([s[2] + g, s[3] + g, s[4] + g]) sphere(1, $fn = 28);
module bodyShape(g = 0) {
  for (i = [0 : len(BODY) - 2]) hull() { sec(BODY[i], g); sec(BODY[i + 1], g); }
  hull() { sec(JAW[0], g); sec(JAW[1], g); }
  hull() { sec(JAW[1], g); sec(BODY[2], g); }
}
color(navy) F() bodyShape();

module nearHalf() intersection() { children(); translate([0, -60, -10]) cube([30, 120, 70]); }
module paint(pts, c) {
  color(c) intersection() { F() nearHalf() bodyShape(0.22); prism(pts); }
  color(c) F() mirror([1, 0, 0]) rotate([0, 0, -YAW]) intersection() { F() nearHalf() bodyShape(0.22); prism(pts); }
}
// yellow lightning and teal streaks
paint([[-6.5, 24], [-4.5, 27], [-3, 26.5], [-4.5, 24.5], [-2.5, 23], [-4, 22.5]], yellow);
paint([[-4.5, 19.5], [-2.5, 22.5], [-1, 22], [-2.8, 19.5]], yellow);
paint([[1, 17.5], [3, 15.5], [2, 13], [4.5, 11], [6.8, 12], [5, 14], [6.5, 16], [4, 18]], yellow);
paint([[-8, 15.5], [-5.5, 17], [-4.5, 16], [-6.5, 14.5]], yellow);
paint([[3.5, 25], [5.5, 23], [7, 23.5], [5, 25.6]], yellow);
paint([[-9, 24], [-7, 26.5], [-6, 26], [-8, 23.5]], teal);
paint([[-1, 25], [1, 27.5], [2, 27], [0, 24.5]], teal);
paint([[5, 20.5], [7.5, 22], [8, 21], [5.5, 19.8]], teal);
paint([[-13, 19.8], [-9, 19.6], [-9, 18.9], [-13, 19.1]], teal);

// ---- face
// glowing white eyes, almond under a hard navy lid
F() both() eye(L(-10.2, 21.6, 4.6), 1.7, iris = eyeGlow, sclera = eyeGlow, pupil = eyeGlow, yaw = 58, lid = 0.32,
                lid_tilt = 18, lid_c = navy, squint = 0.25);
// the closed grin: a dark line between the jaws, pearl beads along both lips
color(throat) F() translate(L(-11, 16.6)) scale([3.4, 4.2, 0.9]) sphere(1, $fn = 20);
F() both() color(pearl) {
  for (t = [0 : 1 / 7 : 1.01]) translate(L(-15.4 + 10.4 * t, 15.3 + 2.5 * t, min(5.3, 2.1 + 3.4 * t))) sphere(0.78, $fn = 12);
  for (t = [0 : 1 / 3 : 1.01]) translate(L(-9 + 5 * t, 17.7 + 1.1 * t, 4.9 + 0.6 * t)) sphere(0.7, $fn = 12);
  translate(L(-16, 15.4, 0.9)) sphere(0.75, $fn = 12);
}

// ---- gold spikes in two rows down the back, a few on the tail root
F() both() color(gold) {
  for (s = [[-4.5, 29.8, 1.8, 4.6], [-0.8, 29.8, 1.8, 4.6], [2.8, 27.8, 1.8, 4.2], [6.2, 24.4, 1.6, 3.6], [9.2, 21.8, 1.2, 2.8]])
    spike(L(s[0], s[1], s[2]), [1.1, 2.6, 2.8] * s[3] / 4, 1.25, 0.08);
  for (s = [[-2.5, 25.5], [1.2, 23.5], [4.8, 21.2]]) spike(L(s[0], s[1], 4.6), [2.2, 2.4, 1.6], 1, 0.08);
  for (s = [[10.6, 20.2], [12.4, 19.6]]) spike(L(s[0], s[1], 0.9), [1.1, 2.2, 1.4], 0.7, 0.06);
}

// ---- back feathers: pale jade fins with a jade rim and a gold leading edge, in the midplane
FEATH = [[[-1.5, 31.5], [0.3, 33.6], [2.4, 36], [4.4, 38.2], [5.9, 40], [6, 38.2], [5.6, 36.4], [5.9, 35.2], [4.9, 34.4],
          [4.4, 33.2], [3.4, 32], [2.4, 30.6]],
         [[5.5, 30.5], [8, 31.8], [11, 33.6], [14, 35.8], [16.3, 37.6], [17.8, 39.2], [17.9, 37.2], [17.3, 35], [16, 33.5],
          [16.8, 32.4], [15, 31.6], [14.2, 30.4], [14.8, 29.6], [12.6, 28.6], [12.2, 27.4], [11, 26.6], [9.5, 25.2], [7.5, 25.5]]];
EDGE = [[[-1.2, 31.8], [0.6, 34.2], [2.6, 36.6], [4.4, 38.5], [5.9, 40]], [[5.8, 30.8], [8.2, 32.1], [11.2, 34], [14.2, 36.2], [16.3, 37.9], [17.8, 39.2]]];
F() side(0) {
  for (f = FEATH) { plate(f, 1.6, 0.5, paleJade); color(jade) core(f, 1.9, 1.5); }
  color(gold) for (e = EDGE) for (i = [0 : len(e) - 2])
    hull() { translate([e[i][0], 0, e[i][1]]) sphere(0.56, $fn = 10); translate([e[i + 1][0], 0, e[i + 1][1]]) sphere(0.41, $fn = 10); }
}

// ---- tail: a forked jade fin with a navy core, a yellow stripe and a gold upper edge
TAIL = [[10, 19], [13, 21], [17, 23], [21.4, 24.4], [19.4, 21], [18.2, 19.4], [19.6, 17.2], [18.4, 15], [19, 12.5],
        [18.4, 10], [15.5, 12.5], [12.5, 15], [10.5, 16]];
F() side(0) {
  plate(TAIL, 2, 0.6, paleJade);
  color(navy) intersection() { core(TAIL, 2.2, 1.2); rotate([90, 0, 0]) linear_extrude(height = 3, center = true) polygon([[9, 13], [9, 20], [15, 20], [15, 13]]); }
  color(yellow) intersection() { core(TAIL, 2.3, 0.6); rotate([90, 0, 0]) linear_extrude(height = 3, center = true) polygon([[14, 19.6], [20.5, 23.4], [20.8, 22.6], [15, 18.6]]); }
  color(gold) for (e = [[[10, 19.2], [15, 22.2]], [[15, 22.2], [21.4, 24.4]]]) hull() { translate([e[0][0], 0, e[0][1]]) sphere(0.55, $fn = 10); translate([e[1][0], 0, e[1][1]]) sphere(0.45, $fn = 10); }
}

// ---- fins hung off the flanks
// a feather strand from root a to tip b, w wide: a long leaf with a ragged trailing edge
function leaf(a, b, w) = let(d = b - a, n = [-d[1], d[0]] / norm(d))
  [a + n * w * 0.5, a + d * 0.45 + n * w * 0.55, a + d * 0.8 + n * w * 0.25, b, a + d * 0.72 - n * w * 0.1,
   a + d * 0.62 - n * w * 0.4, a + d * 0.4 - n * w * 0.3, a + d * 0.3 - n * w * 0.5, a - n * w * 0.5];
// pectorals: five strands fanned down and back from the flank, navy near the body, jade then pale mint outside, each
// with a gold rib along its upper edge
PEC = [[[-0.5, 13.5], [0.5, 3.7], 3.2, 0], [[2.5, 14.5], [8.6, 3.2], 3.6, 0], [[4.5, 15], [16.5, 1.4], 4, 1],
       [[6.5, 15.5], [21, 2], 4, 2], [[8, 16], [19, 9.6], 3.4, 2]];
PEC_C = [navy, jade, paleJade];
hinged(5, 15.5, -26) for (f = PEC) {
  plate(leaf(f[0], f[1], f[2]), 1.3, 0.3, PEC_C[f[3]], grow = 0.3);
  if (f[3] == 2) color(jade) core(leaf(f[0], f[1], f[2]), 1.5, 0.9);
  if (f[3] == 0) color(teal) core(leaf(f[0] + (f[1] - f[0]) * 0.25, f[0] + (f[1] - f[0]) * 0.7, f[2] * 0.25), 1.5, 0);
  let(d = f[1] - f[0], n = [-d[1], d[0]] / norm(d), a = f[0] + n * f[2] * 0.42, b = f[1] + n * 0.1)
    color(gold) hull() { translate([a[0], 0, a[1]]) sphere(0.6, $fn = 10); translate([b[0], 0, b[1]]) sphere(0.3, $fn = 8); }
}
hinged(5, 15.5, -26) color(yellow) core([[1.5, 14.5], [4, 11], [3.5, 9], [6, 7.5], [7, 9], [5, 11.5], [6.5, 14]], 1.6, 0);
hinged(5, 15.5, -26) for (s = [[0, 13, -1.5, -1.6], [2.4, 11, -0.8, -2], [-1.4, 10, -1.6, -1.2]]) spike([s[0], 0, s[1]], [s[2], 0, s[3]], 0.65, 0.05, gold);
// throat fins: navy with gold spikes along the edge, a jade beard hanging under them
THROATFIN = [[-16, 14.6], [-18, 15.7], [-19.5, 13.4], [-20.8, 10.8], [-19, 9.5], [-18, 3.7], [-15.5, 5.2], [-12.5, 1.1],
             [-10.8, 6], [-9.2, 9.5], [-10.6, 13.6]];
hinged(2.2, 13, -10) {
  plate(THROATFIN, 1.2, 0.4, paleJade, grow = 0.35);
  color(jade) intersection() { core(THROATFIN, 1.4, 1.2); rotate([90, 0, 0]) linear_extrude(height = 3, center = true) polygon([[-22, 0], [-8, 0], [-8, 8.5], [-22, 8.5]]); }
  color(navy) intersection() { core(THROATFIN, 1.4, 0.1); rotate([90, 0, 0]) linear_extrude(height = 3, center = true) polygon([[-22, 10.2], [-8, 10.2], [-8, 17], [-22, 17]]); }
  for (s = [[-17, 14.4, -1.2, 1.9], [-18.6, 12.2, -1.9, 1.5], [-19.6, 10.4, -2, 0.6]]) spike([s[0], 0, s[1]], [s[2], 0, s[3]], 0.8, 0.05, gold);
}
// a navy belly fin, tip (-5, 7.6)
hinged(2.6, 11.5, -20) plate([[-8, 11], [-5, 7.4], [-3.5, 9.5], [-1, 10.5], [-2, 12]], 1.2, 0.4, navy);

// ---- the lure: a navy stalk to a glowing gold bulb in a gold ring with eight small rays
STALK = [[-7.9, 27], [-8.6, 29.5], [-9.6, 31], [-11.3, 32.6], [-13, 33.2], [-15, 32.6], [-16.6, 31.2], [-17.6, 29.7]];
F() chain([for (p = STALK) L(p[0], p[1])], [for (i = [0 : len(STALK) - 1]) 0.72 - i * 0.03], navy);
LURE = L(-18.6, 27.1);
F() translate(LURE) {
  color(bulb) sphere(2.6, $fn = 28);
  // the ring and its rays stand in the fish's midplane (the v-z plane)
  color(gold) rotate([0, 90, 0]) rotate_extrude($fn = 32) translate([3, 0]) circle(0.38, $fn = 8);
  color(gold) for (a = [0 : 45 : 315]) rotate([a, 0, 0]) translate([0, 0, 3.2]) cylinder(h = 0.9, r1 = 0.4, r2 = 0.04, $fn = 8);
}

// ---- the halo: a gold arch in the midplane over the head, a grey-green gem in a gold bezel at its top
HALO = L(-7.5, 28.8);
F() translate(HALO) {
  color(gold) rotate([0, 90, 0]) scale([1, 1.02, 1]) intersection() {
    rotate_extrude($fn = 40) translate([5.1, 0]) circle(0.55, $fn = 8);
    translate([-7, -7, -1]) cube([7 + 3.3, 14, 2]);
  }
  color(gold) translate([0, 0, 5.2]) rotate([0, 90, 0]) cylinder(h = 0.9, r = 1.1, center = true, $fn = 14);
  color(gem) translate([0, 0, 5.2]) scale([1.2, 0.8, 0.8]) sphere(0.8, $fn = 12);
}
