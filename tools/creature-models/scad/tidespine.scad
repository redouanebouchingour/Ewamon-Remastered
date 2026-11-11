// Tidespine: a blue baby dinosaur standing side-on in a stride, remodelled to its sprite (2026-11-06).
// Checklist (front sheet, 40 units tall, 42.9 wide):
//   head  drawn in profile, snout to the viewer's left (sheet x -21.8..-6, z 28.4..38.5): so the head is turned 50 deg
//         towards the creature's right (headFrame) and authored in its own frame (S()). A round domed skull (top z 38.5
//         at x -14..-11) tapering to a blunt snout (-21.8, 29..32.5). A cream lower jaw (z 28.4..30.4) under a dark
//         mouth line that ends in a little smile at (-11, 30.5). Nostril (-19.4, 31.7). Big cute eye at (-13.3, 33.6),
//         r ~1.6: navy with a light blue iris low right, a white glint top left, a soft brow ridge over it.
//   neck  long and thick, from the head back (-7, 34) down to the shoulders (-1, 26); cream throat down its front.
//   chest a collar of grey stones round a glowing blue gem (-7.8, 21.8) on the cream chest.
//   body  big rounded torso z 8..27, cream belly between the legs (x -3..3, z 8..15) with light plate bands.
//   arms  far arm reaching forward to the viewer's left, a grey stone hand with a round crystal knuckle and a crystal
//         spike (-17..-11, 13..20), grey claws down; near arm short, its hand a stone cluster with a square crystal and
//         two crystal spikes in front of the belly (-6..2, 11..20).
//   legs  digitigrade: near thigh a big oval (2..9, 8..21), foot fanned with three grey claws (3..10, 0..3); far leg
//         striding forward, foot (-15..-8, 2..6). Grey sole pads (the back art).
//   sail  a fan of pale ice-crystal shards on the back (x -6..10, z 22..40) with a big dark stone in it (-0.5..5,
//         29.5..35), grey stones round its base, dark grey spikes down the back towards the tail.
//   tail  thick, back and to the viewer's right along z 8..15 with a cream underside and crystal tufts on top, curling
//         up into a grey leaf-shaped fan fin with dark veins (13..21.5, 17.5..31.5) tipped with a crystal cluster.
//   back  a glowing gem and grey stones on the back (the back art).
include <lib.scad>

blue = [0.24, 0.49, 0.62];
blueHi = [0.33, 0.58, 0.7];
blueDk = [0.16, 0.35, 0.49];
cream = [0.89, 0.85, 0.63];
creamDk = [0.74, 0.69, 0.5];
stone = [0.34, 0.37, 0.37];
stoneHi = [0.46, 0.5, 0.48];
stoneDk = [0.2, 0.25, 0.27];
crystal = [0.73, 0.85, 0.86];
crystalHi = [0.87, 0.97, 0.97];
crystalDk = [0.57, 0.68, 0.7];
gem = [0.35, 0.8, 1, GLOW];
fanGrey = [0.5, 0.54, 0.53];
ink = [0.05, 0.09, 0.13];
eyeIris = [0.45, 0.78, 0.95, NOGLOW];

// ---------- crystal shard: a hexagonal prism from p to q with a pointed tip
module shard(p, q, r, c) {
  d = q - p; l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.78, r1 = r * 0.8, r2 = r, $fn = 6);
    translate([0, 0, l * 0.78]) cylinder(h = l * 0.22, r1 = r, r2 = 0.05, $fn = 6);
  }
}
function F(sx, z, y) = fromSheet(sx, z, y);

// The family's cute eye: the shape of lib.scad's eye() (so the rig's lids fit it) but drawn like the art: a navy eye
// with a big dark pupil, a light blue iris crescent low on the outer side and a white glint high on the inner side.
module cuteEye(p, size, yaw, flat = 0.55, iris = eyeIris, navy = [0.07, 0.13, 0.19]) {
  translate(p) rotate([0, 0, yaw]) {
    color(navy) scale([1, flat, 1.15]) sphere(size, $fn = 20);
    color(iris) intersection() {
      translate([0, -size * flat * 0.5, -size * 0.12]) scale([0.82, 0.55, 0.92]) sphere(size, $fn = 18);
      translate([-size * 0.1, -size * 2, -size * 0.25]) rotate([0, -35, 0]) translate([-size * 2, 0, -size * 2]) cube([size * 4, size * 2, size * 2]);
    }
    color([0.03, 0.07, 0.1]) translate([-size * 0.08, -size * flat * 0.7, size * 0.08]) scale([0.5, 0.42, 0.62]) sphere(size, $fn = 14);
    color("white") translate([-size * 0.32, -size * flat * 0.98, size * 0.4]) scale([1, 0.6, 1.1]) sphere(size * 0.24, $fn = 10);
  }
}

// ---------- head (its own frame: x = side, -y = snout, z = up). Sheet x = HS + 0.174 x + 0.985 y.
HC = [-6.5, -11.5, 0];
HS = 0.866 * HC[0] + 0.5 * HC[1];
function S(sx, z, x = 0) = [x, (sx - HS - 0.174 * x) / 0.985, z];
module headFrame() { translate(HC) rotate([0, 0, -50]) children(); }

module head() {
  // Skull: a round dome hulled into a blunt snout.
  color(blue) hull() {
    translate(S(-12, 34.8)) scale([3.6, 4.6, 4]) sphere(1, $fn = 26);
    translate(S(-8.4, 34)) scale([3.2, 2.8, 3.6]) sphere(1, $fn = 18);
    translate(S(-19.4, 31.3)) scale([2.3, 2.4, 2.1]) sphere(1, $fn = 18);
  }
  // Cream lower jaw, wide at the back.
  color(cream) hull() {
    translate(S(-19.2, 29.6)) scale([1.85, 1.9, 0.9]) sphere(1, $fn = 14);
    translate(S(-12, 30)) scale([2.7, 3.2, 1.5]) sphere(1, $fn = 16);
  }
  // Dark mouth line along each side, curling up into a smile at the corner.
  mirror_x() color(ink) {
    hull() { translate(S(-20.6, 30.3, 1.25)) sphere(0.2, $fn = 6); translate(S(-15, 29.95, 2.25)) sphere(0.2, $fn = 6); }
    hull() { translate(S(-15, 29.95, 2.25)) sphere(0.2, $fn = 6); translate(S(-11.6, 30.4, 2.6)) sphere(0.2, $fn = 6); }
    hull() { translate(S(-11.6, 30.4, 2.6)) sphere(0.2, $fn = 6); translate(S(-10.9, 31.1, 2.6)) sphere(0.2, $fn = 6); }
  }
  // Nostrils.
  mirror_x() ell([0.35, 0.35, 0.25], S(-19.6, 31.8, 1.5), ink);
  // Eyes: big and round, navy with a light blue iris and a white glint, under a soft brow ridge.
  mirror_x() {
    cuteEye(S(-13.3, 33.6, 2.7), 1.9, 64);
    color(blue) translate(S(-13.4, 35.6, 2.1)) rotate([0, 0, 64]) scale([2.3, 1.3, 0.8]) sphere(1, $fn = 12);
  }
}
headFrame() head();

// ---------- neck and torso
neck = [[-1.6, -5, 23], [-3.2, -8, 27.5], [-4.6, -10, 31], [-5.8, -11.4, 33.4]];
neckR = [5.6, 5, 4.2, 3.4];
chain(neck, neckR, blue);

module torso(g = 0) {
  hull() {
    translate([-1.4, -5, 20]) scale([5 + g, 5.2 + g, 6.2 + g]) sphere(1, $fn = 30);
    translate([0.4, 2.6, 15]) scale([6.2 + g, 6.4 + g, 7.4 + g]) sphere(1, $fn = 30);
  }
}
color(blue) torso();

// Cream throat and belly: the neck and torso grown a little, cut to their front-and-under side by a half-space (the
// throat faces forward and down along the neck, the belly forward), so the cream reads from every side.
// halfSpace(n, p, k): the points whose offset from p along the unit normal n is more than k.
module halfSpace(n, p, k) { translate(p + n * k) rotate(_dir_rot(n)) translate([-60, -60, 0]) cube([120, 120, 120]); }
NN = [-0.7, -0.44, -0.56];                     // the throat's normal: forward-right and down, square to the neck
NB = [-0.12, -0.9, -0.42];                     // the belly's
module throat(g) { intersection() { chain(neck, [for (r = neckR) r + g]); halfSpace(NN, neck[0], 1.4); translate([-30, -40, 19]) cube([60, 60, 30]); } }
module belly(g) { intersection() { torso(g); halfSpace(NB, [0, -1, 15], 2); translate([-30, -40, 6]) cube([60, 60, 20.5]); } }
color(cream) { throat(0.25); belly(0.25); }
// Light belly plates: thin darker bands across the cream, square to the neck on the throat, level on the belly.
NA = (neck[3] - neck[0]) / norm(neck[3] - neck[0]);
for (t = [2.4 : 2.6 : 12]) color(creamDk) intersection() { throat(0.36); translate(neck[0] + NA * t) rotate(_dir_rot(NA)) translate([-30, -30, 0]) cube([60, 60, 0.45]); }
for (z = [9.6, 12.2, 14.8, 17.4, 20]) color(creamDk) intersection() { belly(0.36); translate([-30, -40, z]) rotate([8, 0, 0]) cube([60, 60, 0.45]); }

// Chest collar: grey stones round a glowing gem on the cream chest.
GC = [-3.4, -10.8, 22];
color(stoneDk) translate(GC + [0.1, 0.5, 0]) rotate([0, 0, -18]) scale([1.9, 0.9, 2]) sphere(1, $fn = 16);
color(gem) translate(GC + [-0.1, -0.2, 0]) rotate([0, 0, -18]) scale([1.35, 0.8, 1.6]) sphere(1, $fn = 14);
for (a = [0 : 60 : 300]) let(o = [cos(a + 20) * 2.5, 0, sin(a + 20) * 2.6])
  color(a % 120 == 0 ? stoneHi : stone) translate(GC + [o[0] * 0.95, 0.6 - o[0] * 0.3, o[2]]) rotate([0, 0, -18])
    scale([1.3, 1, 1.25]) sphere(1, $fn = 10);

// ---------- arms
module claws(p, d, n = 3) { for (k = [0 : n - 1]) let(t = (k - (n - 1) / 2) * 0.9) spike(p + [t, -0.2 * t, 0], d, 0.42, 0.05, stone); }
// Far arm (-X): reaching forward, a stone hand with a round crystal knuckle and a crystal spike.
chain([[-3.2, -6.4, 21.2], [-5.4, -9.4, 18.8], [-6.6, -12.4, 17.2]], [2.3, 2, 1.8], blue);
color(stone) hull() { translate([-7.2, -13.4, 17]) scale([2, 2, 2]) sphere(1, $fn = 12); translate([-7.6, -15, 15.6]) scale([1.7, 1.5, 1.5]) sphere(1, $fn = 12); }
ell([1.3, 1.3, 1.3], [-8, -13.6, 18.8], stoneHi);
ell([1.2, 0.7, 1.2], [-6.4, -14.6, 16.6], crystal);
ell([0.7, 0.4, 0.7], [-6.4, -15.1, 16.6], crystalHi);
shard([-7.8, -14.6, 17.8], [-9, -17, 20], 0.7, crystalHi);
claws([-7.6, -15.4, 15], [0, -0.6, -1.8]);
// Near arm (+X): short, its stone hand in front of the belly with a square crystal and two crystal spikes.
chain([[3, -6.8, 21.4], [4, -8.6, 18], [2.6, -9.8, 16]], [2.1, 1.8, 1.6], blue);
color(stone) hull() { translate([2.4, -10.6, 15.6]) scale([2.5, 1.9, 2]) sphere(1, $fn = 12); translate([1.4, -11.4, 14]) scale([1.9, 1.5, 1.3]) sphere(1, $fn = 12); }
ell([1.2, 1, 1.1], [0.2, -11.4, 15.6], stoneHi);
ell([1.1, 1, 1.1], [3.8, -10.6, 14.8], stoneHi);
color(crystal) translate([2.6, -12.3, 16.2]) rotate([0, 0, -20]) cube([2.4, 0.8, 2.4], center = true);
color(crystalHi) translate([2.6, -12.65, 16.2]) rotate([0, 0, -20]) cube([1.4, 0.5, 1.4], center = true);
shard([3.2, -10.4, 17], [3.6, -10.8, 19.6], 0.5, crystalHi);
shard([4.2, -9.8, 16.4], [5.2, -10, 18.4], 0.45, crystal);
claws([1.8, -11.8, 13.6], [0, -0.5, -1.7]);

// ---------- legs: thick thighs, digitigrade shins, three-toed feet with grey claws and grey sole pads
module leg(thigh, tr, knee, ankle, foot, toeDir) {
  ell(tr, thigh, blue);
  chain([thigh + [0.2, 0.6, -2.6], knee, ankle], [3, 2.3, 1.9], blue);
  color(blue) hull() { translate(ankle) sphere(1.9, $fn = 14); translate(foot) scale([2.3, 2.5, 1.2]) sphere(1, $fn = 14); }
  for (k = [-1, 0, 1]) let(tip = foot + [k * 1.7 + toeDir[0] * 1.6, toeDir[1] * 1.6 - abs(k) * 0.3, -0.2]) {
    limb(foot + [k * 0.7, 0, 0], tip, 0.9, 0.7, blue);
    spike(tip + [0, -0.4, 0.1], [k * 0.4, -1.3, -0.7], 0.55, 0.05, stone);
  }
  color(stone) translate(ankle + [0, 0.9, -1.1]) scale([1.3, 1.1, 0.7]) sphere(1, $fn = 12);
}
leg([4.8, 2.2, 12.8], [3.8, 4.8, 6.2], [5.4, 4.6, 6.8], [5.6, 5, 2.4], [5.6, 2.8, 1.1], [0, -1]);
leg([-4.6, -1, 12.8], [3.4, 4.4, 5.4], [-5.2, -4.6, 7.6], [-5.4, -7, 2.6], [-5.6, -9, 1.1], [0, -1]);

// ---------- tail: back and out to the +X side, curling up into the fan
tail = [[0, 5, 12], [2.6, 9.4, 10.6], [6, 12.2, 10], [9.6, 13.2, 11.2], [12, 13.2, 14.4], [13, 13, 18.6], [13.6, 13, 22.6],
        [14.4, 13, 26.6]];
tailR = [4.4, 3.7, 3.2, 2.7, 2.2, 1.8, 1.4, 1];
chain(tail, tailR, blue);
// Cream underside.
for (i = [0 : 3]) color(cream) hull() for (j = [i, i + 1]) translate(tail[j] + [0.3, -0.6, -tailR[j] * 0.55]) scale([tailR[j] * 0.75, tailR[j] * 0.75, tailR[j] * 0.5]) sphere(1, $fn = 12);
// Crystal tufts on the top of the tail, dark stone spikes between them and down the back.
for (t = [[1, [0.4, 0.6, 2.8]], [2, [0.6, 0.2, 2.6]], [3, [0.6, -0.4, 2.3]]]) let(p = tail[t[0]] + [0, 0, tailR[t[0]] * 0.75]) {
  shard(p, p + t[1], 0.65, crystalHi);
  shard(p + [0.6, 0.4, 0], p + t[1] * 0.7 + [1.2, 0.6, 0], 0.5, crystal);
}
for (p = [[0, 6.2, 19.6], [0, 7.4, 16.6], [0.6, 8.2, 14.2], [4.2, 11.2, 13.2], [7.8, 13, 13.6]]) spike(p, [0.3, 1.4, 2.2], 0.8, 0.08, stone);
// Fan fin: a grey leaf in the picture plane at the tail tip, dark veins fanning on both faces, a crystal cluster on top.
FD = 4.8;
fanPts = [[14.6, 19.4], [13.4, 22.6], [13.3, 26.6], [14.4, 29.4], [16.4, 31], [18.6, 31.2], [20.5, 29.6], [21.4, 26.6],
          [21.2, 22.6], [20, 19.6], [18.2, 17.8], [16.2, 18]];
pp(FD) {
  slab(fanPts, 1.8, fanGrey, inset = 1.2);
  for (s = [-1, 1]) for (t = [[13.8, 25], [14.4, 28.6], [16.4, 30.6], [19.2, 30.6], [21, 27], [21, 22.6], [19.6, 19.6]])
    color(stoneDk) hull() { translate([17.6, s * 0.72, 21]) sphere(0.3, $fn = 6); translate([t[0], s * 0.4, t[1]]) sphere(0.22, $fn = 6); }
  shard([18.4, 0, 25.4], [20.6, 0, 31.4], 1, crystalHi);
  shard([18.8, 0.4, 24.6], [21.4, 0.4, 29.4], 0.8, crystal);
  shard([18, -0.4, 25.6], [19.2, -0.4, 31], 0.7, crystalDk);
}

// ---------- crystal sail: a fan of shards on the back, a big dark stone set in it, grey stones at its base
sail = [ // [tip sheet x, tip z, tip depth y, base sheet x, base z, base y, radius, shade]
  [-5.6, 32.4, -1, -0.6, 25, -2, 1.1, 1], [-3.6, 36.6, 0, 0, 25.6, -1, 1.25, 0], [-0.8, 38.8, 2, 0.6, 25.4, 0, 1.3, 2],
  [1.8, 40.2, 1, 1.4, 25.2, 1, 1.35, 1], [4.4, 39.6, 3, 2.2, 24.6, 2, 1.3, 0], [6.8, 37.6, 2, 3, 24, 3, 1.25, 2],
  [8.8, 34.4, 4, 3.8, 23.4, 4, 1.2, 1], [9.8, 30.8, 5, 4.4, 22.6, 5, 1.1, 0], [9.2, 27.4, 6, 5, 21.6, 6, 1, 2],
  [-2.2, 31, -2.5, 0, 25.4, -2, 0.9, 2], [6.2, 33.2, 0, 3.2, 23.8, 1.5, 0.95, 1],
  [7.6, 30, 6, 4, 22.6, 5.5, 0.9, 1], [-0.6, 35, 4, 1, 25, 2.5, 0.95, 1]];
for (s = sail) shard(F(s[3], s[4], s[5]), F(s[0], s[1], s[2]), s[6] * 1.45, s[7] == 0 ? crystalDk : s[7] == 1 ? crystal : crystalHi);
for (d = [-2.6, 5]) pp(d) {
  color(stoneDk) translate([2.2, 0, 32.2]) scale([2.4, 1.6, 3]) sphere(1, $fn = 16);
  color(stone) translate([1.4, -sign(-d) * 0.6, 33.2]) scale([1.4, 1.4, 1.6]) sphere(1, $fn = 12);
}
for (b = [[-1.4, 25.2, -2.6, 1.3], [1.2, 25.8, -0.6, 1.4], [4, 24.6, 1.6, 1.3], [6.4, 23.4, 4, 1.2], [7.6, 22.2, 6.4, 1.1],
          [3, 22.4, 4.4, 1.2]])
  ell([b[3], b[3], b[3] * 0.85], F(b[0], b[1], b[2]), b[3] > 1.25 ? stone : stoneHi);

// ---------- back: a glowing gem and grey stones (the back art)
color(stoneDk) translate([2.2, 7.4, 17.4]) rotate([0, 0, 25]) scale([1.4, 0.8, 1.6]) sphere(1, $fn = 14);
color(gem) translate([2.4, 7.9, 17.4]) rotate([0, 0, 25]) scale([0.95, 0.55, 1.15]) sphere(1, $fn = 12);
for (p = [[3.6, 7, 14], [-1, 8.4, 15.6], [1, 8.6, 12.6]]) ell([1.05, 0.9, 1], p, stone);
