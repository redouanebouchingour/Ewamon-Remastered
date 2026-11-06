// Thundrix: Stormchick grown into a thunder eagle in flight, its wings flung up in a huge V.
// Checklist (front sheet, 40 tall, tail tip on z ~1):
//   - head: gold, sheet x -4.2..1.8, z 21..27.3, turned to the viewer's left; a crest of five swept spikes up and back
//     (tips z 26.8..28.9); a hooked tan beak at x -4..-1.5, z 21.3..23.8; TWO fierce slanted blue eyes (near at
//     x -1, z 25; far at x -3.9) with a cyan highlight, a gold brow over each and a blue streak running up-back.
//   - neck: gold, ending in a jagged ruff over the chest at z 19..20.5.
//   - body: white chest x -4.4..3.8, z 10..20 (back: brown); pointed at the bottom.
//   - wings (near one read off the sheet, mirrored): the gold arm (back: brown) from the shoulder (2.6, 20.6) up to
//     the wrist (13.6, 35.4); a band of white feathers off the arm (z 20..30); a row of gold coverts (back: white)
//     along a curve from (13, 32.6) down to (4.8, 18.6); 13 long blue flight feathers radiating from that row, the
//     top ones up to (15.8, 38.4), the side ones out to x 19.5, the low ones down to z 15.5 next to the chest.
//   - tail: a fan of five long gold and tan feathers pointing down, x -4.4..8.3, z 1..11.
//   - legs: tan feathered thighs, gold toes with pale claws; the near foot tucked at (2.5, 11), the far one reaching
//     out to (-7, 11.5) gripping a pale-blue lightning bolt that runs down to (-1.6, 2.8).
//   - a few small bolts float round it (blue at (-6, 33) and (12.5, 10), yellow at (4.4, 31.4) and (-14, 12)).
//   - back: brown body and brown wing tops with a white row, blue flight feathers, gold head and tail.
//   Not modelled: the pale aura line and the grey storm-cloud puffs behind the wings.
include <lib.scad>

gold = [0.93, 0.76, 0.35, NOGLOW];
goldTan = [0.86, 0.64, 0.33, NOGLOW];
tan = [0.78, 0.55, 0.33, NOGLOW];
brown = [0.64, 0.42, 0.26, NOGLOW];
brownDk = [0.5, 0.32, 0.2, NOGLOW];
white = [0.97, 0.97, 0.96, NOGLOW];
blue = [0.29, 0.5, 0.78, NOGLOW];
blueLt = [0.37, 0.61, 0.88, NOGLOW];
eyeBlue = [0.08, 0.3, 0.8, NOGLOW];
eyeIris = [0.15, 0.5, 1, NOGLOW];
beakC = [0.8, 0.58, 0.3, NOGLOW];
claw = [0.84, 0.85, 0.86, NOGLOW];
boltBlue = [0.39, 0.66, 0.89, NOGLOW];
boltCore = [0.82, 0.96, 1, GLOW];
boltYel = [0.98, 0.86, 0.4, NOGLOW];

// ---- Wings. Authored in a local frame (u = sheet x, v = depth offset, w = sheet z) that multmatrix stands in the
// scad: the wing plane sits at y = Y0 + S * u (a slight sweep back), and x = (u - 0.5 y) / 0.866 so the near wing
// lands on the sheet 1:1.
Y0 = 1.0;
S = 0.05;
WM = [[(1 - 0.5 * S) / cos(30), -0.5 / cos(30), 0, -0.5 * Y0 / cos(30)], [S, 1, 0, Y0], [0, 0, 1, 0], [0, 0, 0, 1]];

// A flat pointed feather from base B to tip T ([u, w]), w wide, t thick, at depth v.
module leaf(B, T, w, t, v, c) {
  L = norm(T - B);
  d = (T - B) / L;
  color(c) hull() {
    translate([B[0] + d[0] * w * 0.35, v, B[1] + d[1] * w * 0.35]) scale([w / 2, t / 2, w / 2]) sphere(1, $fn = 8);
    translate([B[0] + d[0] * L * 0.6, v, B[1] + d[1] * L * 0.6]) scale([w * 0.42, t / 2, w * 0.42]) sphere(1, $fn = 8);
    translate([T[0], v, T[1]]) scale([0.15, t / 2, 0.15]) sphere(1, $fn = 6);
  }
}
// The same feather in two colours: cF seen from the front, cB from behind.
module leaf2(B, T, w, t, v, cF, cB) {
  leaf(B, T, w, t * 0.6, v - t * 0.25, cF);
  leaf(B, T, w, t * 0.6, v + t * 0.25, cB);
}

// [base on the covert row, blue tip, blue width]
ROWS = [
  [[12.8, 32.6], [15.8, 38.4], 2.0],
  [[13.3, 31.0], [18.0, 36.7], 2.0],
  [[13.6, 29.4], [19.1, 33.4], 2.0],
  [[13.6, 27.8], [19.6, 30.0], 2.0],
  [[13.2, 26.2], [19.3, 25.9], 2.0],
  [[12.6, 24.6], [18.0, 23.2], 2.0],
  [[11.7, 23.2], [16.4, 20.9], 1.9],
  [[10.7, 22.0], [14.5, 18.9], 1.9],
  [[9.7, 21.0], [12.8, 17.2], 1.9],
  [[8.6, 20.2], [11.0, 15.6], 1.8],
  [[7.4, 19.5], [8.9, 15.3], 1.8],
  [[6.1, 19.0], [6.6, 15.2], 1.8],
  [[4.8, 18.6], [4.5, 15.5], 1.7],
];
// white feathers: from the arm out to under the covert row
WHITES = [
  [[9.6, 29.8], [13.0, 28.4]],
  [[8.6, 28.4], [12.8, 26.7]],
  [[7.6, 27.0], [12.2, 25.1]],
  [[6.6, 25.6], [11.4, 23.6]],
  [[5.6, 24.2], [10.4, 22.2]],
  [[4.6, 22.8], [9.2, 21.0]],
  [[3.6, 21.5], [7.8, 20.0]],
  [[3.0, 20.4], [6.2, 19.2]],
];

module wing() multmatrix(WM) {
  // the arm: the leading edge, gold in front, brown on top
  for (k = [[-0.85, gold], [0.05, brown]])
    color(k[1]) for (s = [[[2.0, 20.4], [7.6, 28.0], 1.6, 1.4], [[7.6, 28.0], [13.5, 35.3], 1.4, 0.8]])
      hull() {
        translate([s[0][0], k[0], s[0][1]]) scale([1, 0.5, 1]) sphere(s[2], $fn = 12);
        translate([s[1][0], k[0], s[1][1]]) scale([1, 0.5, 1]) sphere(s[3], $fn = 12);
      }
  // white feathers (brown seen from behind)
  for (f = WHITES) leaf2(f[0], f[1], 2.4, 1.0, -0.15, white, brown);
  for (i = [0 : len(ROWS) - 1]) {
    B = ROWS[i][0];
    T = ROWS[i][1];
    d = (T - B) / norm(T - B);
    // gold coverts over the white ends (white seen from behind)
    leaf2(B - d * 1.6, B + d * 1.6, 2.0, 1.6, -0.2, i % 2 == 0 ? gold : goldTan, white);
    // the long blue flight feathers
    leaf(B + d * 0.5, T, ROWS[i][2], 0.9, 0.35, i % 2 == 0 ? blue : blueLt);
  }
}
mirror_x() wing();

// ---- Body: an upright torso, white chest in front, brown back.
TORSO = [[[4.3, 4.0, 4.6], [0, 1, 16.2]], [[3.0, 3.0, 2.4], [0, 1.4, 11.8]], [[1.4, 1.6, 1.2], [0, 1.2, 10.2]]];
blob(TORSO, brown);
color(white) intersection() {
  hull() for (e = TORSO) translate(e[1]) scale(e[0] + [0.2, 0.2, 0.2]) sphere(1, $fn = 28);
  translate([-10, -10, 0]) cube([20, 10.4, 19.6]);
}

// ---- Neck and head: gold, the head forward and a little down.
HEAD = [0, -2.4, 24.3];
blob([[[3.4, 3.2, 2.6], [0, 0.4, 20.4]], [[3.0, 3.2, 3.0], HEAD]], gold);
// jagged ruff over the chest
for (a = [-50 : 25 : 50]) {
  p = [3.0 * sin(a), 0.4 - 3.0 * cos(a), 19.8];
  color(abs(a) > 30 ? goldTan : gold) hull() {
    translate(p + [0, 0, 0.6]) scale([0.8, 0.5, 0.6]) sphere(1, $fn = 8);
    translate(p + [0, -0.25, -1.3]) sphere(0.12, $fn = 6);
  }
}
// crest: spikes along the top, small at the brow and growing towards the back, all swept up and back
for (k = [[0, -3.6, 27.2, 0.55], [0, -2.2, 28.1, 0.7], [0, -0.5, 28.9, 0.85], [0, 1.4, 29.3, 0.9], [1.3, 0.2, 28.3, 0.7], [-1.3, 0.2, 28.3, 0.7]]) {
  b = [k[0] * 0.5, k[1] - 1.0, k[2] - 2.5];
  color(k[1] > 0 ? goldTan : gold) hull() {
    translate(b) scale([0.7, 1, 1]) sphere(k[3] * 1.4, $fn = 10);
    translate([k[0], k[1], k[2]]) sphere(0.12, $fn = 6);
  }
}
// hooked beak and a small lower bill
chain([[0, -4.9, 23.7], [0, -6.4, 23.5], [0, -7.0, 22.6], [0, -6.7, 21.6]], [1.15, 0.8, 0.5, 0.15], beakC);
limb([0, -4.8, 22.6], [0, -6.0, 22.5], 0.6, 0.3, tan);
// eyes: fierce blue eyes under a gold brow slanting down to the beak, a blue streak painted up and back from each
EYE = [1.75, -4.5, 24.9];
mirror_x() {
  eye(EYE, 0.95, iris = eyeIris, sclera = eyeBlue, pupil = eyeIris, yaw = 38, flat = 0.5, shine = true);
  color(gold) translate([1.5, -4.8, 25.6]) rotate([0, 0, 38]) rotate([0, -24, 0]) scale([1.45, 0.6, 0.5]) sphere(1, $fn = 14);
  color(eyeBlue) intersection() {
    translate(HEAD) scale([3.12, 3.32, 3.12]) sphere(1, $fn = 28);
    hull() {
      translate([2.2, -4.2, 25.4]) scale([0.9, 0.9, 0.3]) sphere(1, $fn = 10);
      translate([2.75, -2.4, 26.0]) scale([0.9, 0.9, 0.2]) sphere(1, $fn = 10);
    }
  }
}

// ---- Tail: a fan of five long feathers pointing down and back.
for (a = [-50, -25, 0, 25, 50]) {
  L = 10.4 - abs(a) * 0.01;
  B = [0, 2.6, 11.6];
  T = B + [L * sin(a), 2.5, -L * cos(a)];
  color(abs(a) == 25 ? goldTan : gold) hull() {
    translate(B + (T - B) * 0.12) scale([1.3, 0.55, 1.3]) sphere(1, $fn = 10);
    translate(B + (T - B) * 0.6) scale([1.4, 0.55, 1.4]) sphere(1, $fn = 10);
    translate(T) sphere(0.15, $fn = 6);
  }
}

// ---- Legs: tan thighs, gold toes, pale claws. Near (+X) foot tucked, far (-X) one out gripping the bolt.
module toe(a, b, c2) {
  limb(a, b, 0.45, 0.32, gold);
  limb(b, c2, 0.3, 0.06, claw);
}
limb([2.0, -0.4, 13.2], [3.2, -1.5, 11.4], 1.4, 0.8, tan);
for (t = [[[2.4, -2.9, 10.6], [2.2, -3.2, 9.6]], [[3.4, -3.1, 10.3], [3.3, -3.4, 9.3]], [[4.2, -2.6, 10.6], [4.4, -2.9, 9.7]]])
  toe([3.2, -1.5, 11.2], t[0], t[1]);
toe([3.2, -1.2, 11.2], [3.5, 0.0, 10.6], [3.4, 0.3, 9.9]);
limb([-2.0, -0.3, 13.2], [-6.3, -1.3, 12.0], 1.4, 0.8, tan);
for (t = [[[-7.5, -2.6, 12.9], [-7.6, -3.1, 11.9]], [[-7.7, -2.7, 11.4], [-7.3, -3.2, 10.6]], [[-6.6, -2.8, 10.8], [-6.0, -3.0, 10.2]]])
  toe([-6.3, -1.4, 11.9], t[0], t[1]);

// ---- Lightning: the bolt the far foot grips, and a few small ones floating round it.
BOLT = [[-6.6, 13.6], [-5.6, 10.2], [-3.4, 9.8], [-1.4, 2.6], [-4.6, 8.2], [-6.8, 8.6], [-8.6, 13.6]];
pp(-2.6) {
  plate(BOLT, 0.6, 0.2, boltBlue, grow = 0.35);
  translate([0, -0.35, 0]) plate(BOLT, 0.2, 0.1, boltCore, grow = -0.25);
}
module zig(p, s, col) pp(-1) translate([p[0], 0, p[1]]) scale([s, 1, s]) translate([5, 0, -8])
  plate(BOLT, 0.5, 0.15, col, grow = 0.3);
zig([-6.2, 33], 0.45, boltBlue);
zig([4.4, 31.4], 0.4, boltYel);
zig([12.6, 10.4], 0.45, boltBlue);
zig([-14, 12.4], 0.4, boltYel);
