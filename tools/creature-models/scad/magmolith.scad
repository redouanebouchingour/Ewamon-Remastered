// Magmolith: Embrock grown into a hulking basalt saurian, a long crocodilian head, a ridge of stone spikes down its
// back, lava cracks across its whole hide and a tail that curls into a hook dripping molten rock.
include <lib.scad>

rock = [0.4, 0.38, 0.34];
rockHi = [0.52, 0.5, 0.45];
rockDark = [0.27, 0.25, 0.23];
belly = [0.38, 0.2, 0.16];
lava = [1, 0.45, 0.08];
lavaHot = [1, 0.75, 0.25];
lavaDeep = [0.8, 0.22, 0.05];
claw = [0.62, 0.6, 0.55];

// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.15) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
// Lava crack: a thin glowing polyline over an ellipsoid surface, given as [az, el] pairs.
module crack(c, r, pts, w = 0.45) {
  for (i = [0 : len(pts) - 2])
    limb(onEll(c, r, pts[i][0], pts[i][1]), onEll(c, r, pts[i + 1][0], pts[i + 1][1]), w, w, lava);
}

bodyC = [0, 3, 11]; bodyR = [9.5, 12, 8];
chestC = [0, -5, 15]; chestR = [7.6, 6.4, 8];

// Body and chest.
color(rock) translate(bodyC) scale(bodyR) sphere(1, $fn = 36);
color(rock) translate(chestC) scale(chestR) sphere(1, $fn = 32);
// Dark molten underbelly.
color(belly) translate([0, 1, 6.5]) scale([8, 11, 4]) sphere(1, $fn = 28);
// Rocky lumps on the back.
for (b = [[-5, 4, 17, 3], [5, 6, 17, 3], [-6, 10, 14, 2.6], [6, 0, 16.5, 2.8], [-7, 2, 15, 2.4], [7, 11, 13.5, 2.4]])
  color(b[0] < 0 ? rockHi : rock) translate([b[0], b[1], b[2]]) scale([b[3], b[3], b[3] * 0.7]) sphere(1, $fn = 14);

// Lava cracks: a web over the chest and the flanks.
crack(chestC, chestR, [[-50, 10], [-25, -5], [0, -20], [25, -5], [50, 15]]);
crack(chestC, chestR, [[-25, -5], [-15, 25], [5, 40]]);
crack(chestC, chestR, [[25, -5], [20, 25], [35, 45]]);
crack(chestC, chestR, [[0, -20], [-5, -45]]);
crack(chestC, chestR, [[-50, 10], [-70, 35]]);
mirror_x() {
  crack(bodyC, bodyR, [[70, -20], [85, 0], [100, -15], [120, 5], [140, -10], [150, 15]]);
  crack(bodyC, bodyR, [[85, 0], [95, 25], [110, 35]]);
  crack(bodyC, bodyR, [[120, 5], [130, 30]]);
}
crack(bodyC, bodyR, [[150, 30], [170, 50], [190, 40], [200, 60]]);
crack(chestC, chestR, [[-35, 30], [-60, 55], [-20, 60]]);
crack(chestC, chestR, [[55, 30], [30, 60]]);

// Head: a long, heavy crocodilian head carried forward, a mouth line, lava-lit eyes under stony brows.
headParts = [[[6.6, 6.4, 5], [0, -9, 23]], [[5.4, 5, 3.6], [0, -15, 22]], [[4.4, 3.6, 2.8], [0, -19, 21.2]]];
blob(headParts, rock);
color(belly) translate([0, -11, 19.6]) scale([5.6, 6.5, 2.4]) sphere(1, $fn = 24);
color(rockDark) intersection() {
  blob([for (h = headParts) [h[0] + [0.15, 0.15, 0.15], h[1]]]);
  translate([0, -16, 21]) rotate([-4, 0, 0]) cube([16, 12, 0.6], center = true);
}
mirror_x() {
  eye([3.8, -14.4, 26.2], 1.4, iris = lava, pupil = [0.15, 0.03, 0.02], sclera = lavaHot, yaw = -25);
  color(rockHi) translate([3.9, -13.6, 27.8]) rotate([0, -15, -25]) scale([2.6, 1.6, 0.8]) sphere(1, $fn = 14);
  ell([0.4, 0.35, 0.4], [1.4, -21.8, 22.6], rockDark);
  // Cheek lava crack.
  crack([0, -12, 23], [6.4, 6.4, 4.6], [[40, -20], [60, -5], [75, -25]], 0.35);
  // Stone horns on the back of the skull.
  spike([3.6, -6, 26.5], [1.2, 2.5, 3.5], 1.3, 0.1, rockHi);
}

// Dorsal ridge: stone spikes from the neck down the back.
for (sp = [[-5, 28, 4.5, 2.2], [-1, 21, 4.8, 2.4], [3, 19.5, 4.8, 2.4], [7, 18.5, 4.2, 2.2], [11, 16.5, 3.4, 1.8], [14.5, 14, 2.6, 1.5]])
  mirror_x() spike([1.5, sp[0], sp[1] - 1.5], [0.6, 1, sp[2]], sp[3], 0.1, sp[0] % 2 == 0 ? rockHi : rock);

// Legs: thick stony limbs with splayed clawed feet.
mirror_x() for (leg = [[6.5, -6, 9, 8.5, -8], [7, 9, 8, 8.5, 10]]) {
  limb([leg[0], leg[1], leg[2]], [leg[3], leg[4], 2], 3.6, 2.6, rock);
  ell([3, 3, 3], [leg[0] + 0.8, leg[1], leg[2] - 1], rockHi);
  blob([[[3, 3.6, 1.4], [leg[3], leg[4] - 1.5, 1.4]], [[2.4, 2, 1.3], [leg[3], leg[4] + 0.6, 1.4]]], rockDark);
  for (a = [-30, 0, 30]) spike([leg[3] + sin(a) * 1.8, leg[4] - 4.6, 1], [sin(a) * 0.7, -1.4, -0.4], 0.55, 0.08, claw);
}

// Tail: a heavy tail that sweeps back and rises into a hook, its underside cracked and its tip dripping lava.
tailPts = [[2, 13, 9], [8, 18, 8], [13, 20, 11], [16, 19, 16], [16.5, 17, 22], [16, 14, 27], [15.5, 10, 29], [15, 7, 27.5]];
chain(tailPts, [4.2, 3.6, 3.1, 2.7, 2.4, 2.1, 1.9, 1.7], rock);
// Glowing zigzag seams along both sides of the tail.
tailR = [4.2, 3.6, 3.1, 2.7, 2.4, 2.1, 1.9, 1.7];
for (side = [-1, 1])
  chain([for (i = [0 : len(tailPts) - 2]) tailPts[i] + [side * tailR[i] * 0.95, 0, (i % 2 == 0 ? 0.8 : -0.8)]],
        [for (i = [0 : len(tailPts) - 2]) 0.4], lava);
ell([1.9, 1.9, 1.9], [15, 7, 27.3], lavaDeep);
ell([1.3, 1.3, 1.3], [15, 6.6, 26.8], lava);
// Molten drips hanging from the hook.
for (d = [[14.4, 6.2, 25.5, 3, 0.55], [15.7, 7.4, 25.2, 2.4, 0.45], [14, 7.8, 25.8, 1.6, 0.4]]) {
  limb([d[0], d[1], d[2]], [d[0], d[1], d[2] - d[3]], d[4], d[4] * 0.6, lava);
  color(lavaHot) translate([d[0], d[1], d[2] - d[3] - 0.5]) sphere(d[4] * 0.8, $fn = 10);
}
