// Embrock: a squat basalt lizard, head raised, glowing lava cracks webbing its chest and flanks, little flames
// licking from its brow and a tail that curls up into a molten tip.
include <lib.scad>

rock = [0.4, 0.38, 0.34];
rockHi = [0.52, 0.5, 0.45];
rockDark = [0.27, 0.25, 0.23];
belly = [0.38, 0.2, 0.16];
throat = [0.33, 0.2, 0.19];
lava = [1, 0.45, 0.08];
lavaHot = [1, 0.75, 0.25];
lavaDeep = [0.8, 0.22, 0.05];
claw = [0.62, 0.6, 0.55];

// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.15) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
function nEll(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
// Lava crack: a thin glowing polyline over an ellipsoid surface, given as [az, el] pairs.
module crack(c, r, pts, w = 0.45) {
  for (i = [0 : len(pts) - 2])
    limb(onEll(c, r, pts[i][0], pts[i][1]), onEll(c, r, pts[i + 1][0], pts[i + 1][1]), w, w, lava);
}
// A flat faceted stone plate lying on an ellipsoid.
module plate(c, r, az, el, s, col = rock) {
  color(col) translate(onEll(c, r, az, el, -0.4)) rotate(_dir_rot(nEll(az, el))) rotate([0, 0, az * 1.7])
    cylinder(h = 1.3, r1 = s, r2 = s * 0.72, $fn = 6);
}

chestC = [0, -4.5, 14]; chestR = [8.6, 7.2, 8.6];
hipC = [0, 7, 11.5]; hipR = [9, 8.5, 7.6];

// Torso: deep chest up front, broad hips behind, a dark molten underbelly.
color(rock) hull() {
  translate(chestC) scale(chestR) sphere(1, $fn = 32);
  translate(hipC) scale(hipR) sphere(1, $fn = 32);
}
color(belly) hull() {
  translate([0, -3, 9]) scale([6.6, 5.6, 4]) sphere(1, $fn = 24);
  translate([0, 8, 7.5]) scale([7.4, 7, 3.4]) sphere(1, $fn = 24);
}

// Stone plates over the back and flanks.
for (p = [[0, 70, 3.4], [60, 45, 3.0], [-60, 45, 3.0], [100, 20, 3.0], [-100, 20, 3.0], [135, 45, 3.2], [-135, 45, 3.2],
          [180, 55, 3.2], [150, 15, 2.8], [-150, 15, 2.8], [180, 20, 3.0], [115, -10, 2.6], [-115, -10, 2.6]])
  plate(hipC, hipR, p[0], p[1], p[2], p[0] % 3 == 0 ? rockHi : rock);
for (p = [[50, 55, 2.8], [-50, 55, 2.8], [85, 25, 2.8], [-85, 25, 2.8], [0, 75, 3]])
  plate(chestC, chestR, p[0], p[1], p[2], p[0] < 0 ? rockHi : rock);

// Lava cracks: a web over the chest, shoulders and flanks.
crack(chestC, chestR, [[-55, 15], [-30, 0], [0, -12], [30, 0], [55, 15]]);
crack(chestC, chestR, [[-30, 0], [-22, 25], [-5, 42]]);
crack(chestC, chestR, [[30, 0], [22, 25], [5, 42]]);
crack(chestC, chestR, [[0, -12], [-6, -32], [4, -48]]);
crack(chestC, chestR, [[-55, 15], [-70, 40]]);
crack(chestC, chestR, [[55, 15], [70, 40]]);
mirror_x() {
  crack(hipC, hipR, [[70, -15], [90, 5], [105, -10], [125, 5], [145, -12], [160, 8]]);
  crack(hipC, hipR, [[90, 5], [98, 30], [118, 40]]);
  crack(hipC, hipR, [[125, 5], [138, 30]]);
}
crack(hipC, hipR, [[160, 35], [175, 50], [190, 38]]);
crack(hipC, hipR, [[-160, 35], [-170, 60], [-150, 75], [-120, 60]]);
crack(hipC, hipR, [[150, 60], [120, 75], [60, 70]]);
crack(chestC, chestR, [[140, 60], [170, 70], [-160, 65]]);

// Neck: thick and short, carrying the head up and forward; the dark throat continues under it.
color(rock) hull() {
  translate([0, -4, 19]) scale([7.4, 6, 6]) sphere(1, $fn = 24);
  translate([0, -7.5, 24]) scale([7, 5.4, 5]) sphere(1, $fn = 24);
}
color(throat) hull() {
  translate([0, -10.6, 19.6]) scale([4.6, 3, 2.4]) sphere(1, $fn = 20);
  translate([0, -12.6, 22.4]) scale([5.6, 4, 2.6]) sphere(1, $fn = 20);
}

// Head: a broad, flat monitor-lizard head tilted up; a heavy upper skull over a wide lower jaw and a long mouth line.
module head() {
  // Skull and blunt snout, flat on top.
  color(rock) hull() {
    translate([0, 1.5, 1]) scale([6.6, 5, 3.8]) sphere(1, $fn = 28);
    translate([0, -5, 1]) scale([6, 4, 3]) sphere(1, $fn = 24);
    translate([0, -9.4, 0.2]) scale([4.4, 2.2, 2.3]) sphere(1, $fn = 20);
  }
  // Lower jaw: wide and heavy, the dark throat behind it.
  color(rock) hull() {
    translate([0, -0.5, -2.4]) scale([6.2, 4.6, 2.6]) sphere(1, $fn = 24);
    translate([0, -8.2, -1.6]) scale([4.2, 2.4, 1.5]) sphere(1, $fn = 18);
  }
  // Mouth line: a dark seam from cheek to cheek round the snout.
  color([0.12, 0.08, 0.07]) for (s = [-1, 1]) chain(
    [[s * 6.2, 2.5, -0.4], [s * 6.1, -2, -0.6], [s * 5.2, -6.4, -0.4], [s * 3.6, -9.4, -0.2], [0, -10.4, -0.1]],
    [0.45, 0.45, 0.42, 0.4, 0.38]);
  // Heavy brow ridges and the eyes under them.
  mirror_x() {
    // Big glowing lava eyes sunk into the skull under a stone brow slanting down to the snout.
    eye([4.3, -6.6, 2], 2.3, iris = [1, 0.8, 0.25, GLOW], pupil = [0.15, 0.03, 0.02], sclera = [1, 0.42, 0.06, GLOW],
        yaw = 12, flat = 0.55, lid = 0.42, lid_tilt = 28, lid_c = rock, slit = 0.4);
    color(rockHi) hull() {
      translate([5, -5.3, 4.5]) scale([1.6, 1.9, 0.85]) sphere(1, $fn = 12);
      translate([1.9, -8.5, 3.4]) scale([0.9, 1.1, 0.6]) sphere(1, $fn = 10);
    }
    color(rockDark) translate([1.6, -10.7, 0.9]) scale([0.5, 0.35, 0.4]) sphere(1, $fn = 8);
  }
  // Brow flames rising from the back of the skull.
  mirror_x() for (f = [[0, 0, 6.5, 1.8, lavaDeep], [0.7, -0.9, 4.6, 1.4, lava], [-0.5, 0.6, 3.4, 1.1, lavaHot]])
    color(f[4]) hull() {
      translate([4 + f[0], 1 + f[1], 3.4]) sphere(f[3], $fn = 10);
      translate([4.6 + f[0] * 1.6, 1.8 + f[1], 3.4 + f[2]]) sphere(0.15, $fn = 6);
    }
}
translate([0, -10.5, 26.8]) rotate([-12, 0, 0]) scale(1.22) head();

// Legs: thick, splayed lizard limbs, elbows and knees out, with long-toed clawed feet.
module foot(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(rockDark) hull() {
      translate([0, 0.5, 1.2]) scale([3, 3, 1.4]) sphere(1, $fn = 16);
      translate([0, -2, 1]) scale([3.2, 1.8, 1]) sphere(1, $fn = 14);
    }
    for (a = [-34, -11, 11, 34]) {
      tip = [sin(a) * 5, -cos(a) * 5.2, 0.6];
      limb([sin(a) * 1.4, -1.6, 1.1], tip, 0.95, 0.65, rockDark);
      spike(tip + [0, 0, 0.1], [sin(a) * 0.9, -cos(a) * 1.3, -0.5], 0.5, 0.06, claw);
    }
  }
}
mirror_x() {
  // Front: shoulder, a bent elbow pushed out, forearm down to the foot.
  chain([[6.5, -4, 14], [10.8, -5.5, 8.5], [10.6, -7.5, 2.4]], [4.2, 3.4, 2.8], rock);
  plate([10.8, -5.5, 8.5], [3.4, 3.4, 3.4], 70, 10, 2.2, rockHi);
  foot([10.8, -8, 0], -12);
  // Hind: a big haunch and a short shin.
  color(rock) translate([7.8, 9, 11]) scale([4, 5.4, 5.6]) sphere(1, $fn = 22);
  chain([[9, 8, 9], [11.4, 7.5, 5.5], [10.8, 8.4, 2.2]], [4, 3.2, 2.6], rock);
  plate([7.8, 9, 11], [4, 5.4, 5.6], 90, 15, 2.6, rockHi);
  foot([11, 7.2, 0], -16);
}

// Tail: thick at the root, sweeping back and curling high, dark red underneath and cracked, ending in a molten
// crescent that hooks forward.
tailPts = [[0, 14, 10], [3, 19.5, 7.5], [9, 22, 8], [13.5, 20.5, 12.5], [15, 17.5, 18], [14.8, 14.5, 23]];
tailR = [6, 5, 4.2, 3.5, 3, 2.6];
chain(tailPts, tailR, rock);
chain([for (i = [0 : 3]) tailPts[i] + [0, 0.4, -tailR[i] * 0.4]], [for (i = [0 : 3]) tailR[i] * 0.72], belly);
for (side = [-1, 1])
  chain([for (i = [0 : len(tailPts) - 1]) tailPts[i] + [side * tailR[i] * 0.92, 0, (i % 2 == 0 ? 0.6 : -0.6)]],
        [for (i = [0 : len(tailPts) - 1]) 0.38], lava);
// Glowing rings between the tail's stone segments, and stone plates with a lava net between them over its top and
// upper flanks, so it reads as plated rock rather than a tube from behind.
for (i = [1 : len(tailPts) - 2])
  color(lava) translate(tailPts[i]) rotate(_dir_rot(tailPts[i + 1] - tailPts[i - 1])) scale([1, 1, 0.07]) sphere(tailR[i] + 0.15, $fn = 18);
function tnorm(t) = let(u = [0, 0.45, 1], n = u - t * (u * t)) n / norm(n);
module tailNet(pts, R) {
  for (i = [0 : len(pts) - 2]) let(a = pts[i], b = pts[i + 1], t = (b - a) / norm(b - a), n = tnorm(t), bn = cross(t, n),
                                    r = (R[i] + R[i + 1]) / 2, m = (a + b) / 2) {
    for (ang = [-72, 0, 72]) let(dr = n * cos(ang) + bn * sin(ang))
      color((i + ang / 72) % 2 == 0 ? rockHi : rock) translate(m + dr * (r - 0.35)) rotate(_dir_rot(dr)) rotate([0, 0, 30 * i])
        cylinder(h = 0.9, r1 = r * 0.5, r2 = r * 0.36, $fn = 6);
    for (ang = [-36, 36, -108, 108]) let(d0 = n * cos(ang) + bn * sin(ang), dk = n * cos(ang + 12) + bn * sin(ang + 12))
      color(lava) {
        hull() { translate(a + d0 * (R[i] + 0.1)) sphere(0.28, $fn = 6); translate(m + dk * (r + 0.1)) sphere(0.28, $fn = 6); }
        hull() { translate(m + dk * (r + 0.1)) sphere(0.28, $fn = 6); translate(b + d0 * (R[i + 1] + 0.1)) sphere(0.28, $fn = 6); }
      }
  }
}
tailNet(tailPts, tailR);
// The molten tip: a widening crescent, deep red at the base, bright towards the hook.
tip = [[14.8, 14.5, 23], [14.2, 12.4, 27], [13, 9.4, 29], [11.4, 6.8, 28.4], [10.4, 5.4, 26.4]];
tipW = [2.6, 3, 2.8, 1.9, 0.35];
for (i = [0 : len(tip) - 2]) color(i < 1 ? lavaDeep : (i < 3 ? lava : lavaHot)) hull() {
  translate(tip[i]) scale([0.75, 1, 1]) sphere(tipW[i], $fn = 14);
  translate(tip[i + 1]) scale([0.75, 1, 1]) sphere(tipW[i + 1], $fn = 14);
}
// Embers dripping off the tip.
for (e = [[10.5, 6, 24, 0.45], [12, 8, 25, 0.38], [9.6, 5, 22.4, 0.32]]) color(lava) translate([e[0], e[1], e[2]]) sphere(e[3], $fn = 8);
