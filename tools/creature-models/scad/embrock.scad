// Embrock: a heavy grey stone monitor lizard on four thick clawed legs, a big raised head with a heavy brow, an
// orange slit eye and a small flame rising from each front corner of the skull, rock scales webbed with glowing lava
// cracks, and a long thick tail that rises behind it and curls into a molten crescent.
//
// Checklist (front sheet, 40 units; parts further back read about 0.17 z per unit of depth higher on the sheet):
//   head      x -18..0, z 23..36.3: broad flat skull, snout to the viewer's left, raised; two brow bumps on top
//             (far x -15..-13, near x -8.6..-5.5); long dark mouth line z 29.5..31 from the snout to the cheek
//   eye       near one at x -8.6..-6, z 31.7..34.2: orange, black ring, vertical black slit, a pale glint; heavy
//             dark brow over it. The far eye shows in the back art (two eyes).
//   flames    two small flames rising from the front corners of the skull top (x -19..-16 and -13.7..-9, z 33..39),
//             dark red edge, orange, a yellow core, embers above
//   throat    dark brown pouch under the jaw, x -16..-6, z 22..28
//   chest     upright and massive, x -12..8, z 7..25, crack web (Y down the chest, a band across the belly line)
//   belly     dark red underside z 7..11
//   legs      thick, splayed, four-toed clawed feet: far front x -18..-10, near front x -3..7 (lowest), near hind
//             x 10..17, far hind under the belly x -8..-1 (in shadow)
//   tail      thick root behind the near haunch, rising at x 14..20 z 9..25, dark red underside with cracks, then a
//             molten crescent tip hooking back, x 10..19.5, z 24..31
//   back      rock scales over the back, cracks over the neck and shoulders and along the tail
include <lib.scad>

rock = [0.42, 0.39, 0.35];
rockHi = [0.55, 0.51, 0.45];
rockDark = [0.27, 0.23, 0.22];
throat = [0.29, 0.19, 0.18];
belly = [0.38, 0.16, 0.12];
ink = [0.08, 0.05, 0.04];
lava = [0.94, 0.36, 0.08, GLOW];
lavaHot = [0.98, 0.55, 0.16, GLOW];
lavaDeep = [0.71, 0.23, 0.09, NOGLOW];
lavaDark = [0.45, 0.12, 0.06, NOGLOW];
claw = [0.62, 0.6, 0.55];

// ---- helpers
function rnd(i) = let(v = sin(i * 12.9898 + 78.233) * 43758.5453) v - floor(v);
// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.3) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
function nEll(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
// One crack between two [az, el] points: a thin fan from the centre through both points. Cut by a thin shell over the
// part (cracked()), it leaves a glowing line lying flush on the surface.
module crackSeg(c, r, a, b, w) {
  hull() {
    translate(c) sphere(w / 2, $fn = 6);
    translate(c + (onEll(c, r, a[0], a[1], 0) - c) * 1.6) sphere(w / 2, $fn = 6);
    translate(c + (onEll(c, r, b[0], b[1], 0) - c) * 1.6) sphere(w / 2, $fn = 6);
  }
}
// The glowing cracks: children(0) is a thin shell just over the part's skin, children(1) the crack fans.
module cracked() { color(lava) intersection() { children(0); union() children(1); } }
module ellShell(c, r, fn = 36) {
  difference() {
    translate(c) scale(r + [0.14, 0.14, 0.14]) sphere(1, $fn = fn);
    translate(c) scale(r - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
  }
}
// Lava crack network: a jittered grid of nodes over an az / el window, its edges (and a diagonal per cell, either
// way) dropped at random so the cells read as irregular stone plates.
module crackNet(c, r, az0, az1, el0, el1, na, ne, seed, w = 0.68, keep = 0.66, diag = 0.5) {
  function node(i, j) = [az0 + (az1 - az0) * (i + (i > 0 && i < na ? 0.75 * (rnd(seed + i * 31 + j * 17) - 0.5) : 0)) / na,
                         el0 + (el1 - el0) * (j + (j > 0 && j < ne ? 0.75 * (rnd(seed + i * 13 + j * 29 + 5) - 0.5) : 0)) / ne];
  for (i = [0 : na], j = [0 : ne]) {
    if (i < na && j > 0 && rnd(seed + i * 7 + j * 11 + 1) < keep) crackSeg(c, r, node(i, j), node(i + 1, j), w);
    if (j < ne && rnd(seed + i * 5 + j * 19 + 2) < keep) crackSeg(c, r, node(i, j), node(i, j + 1), w);
    if (i < na && j < ne && rnd(seed + i * 23 + j * 3 + 4) < diag) let(f = rnd(seed + i * 3 + j * 23 + 6) < 0.5)
      crackSeg(c, r, node(i, f ? j : j + 1), node(i + 1, f ? j + 1 : j), w);
  }
}
// A low rock scale lying on an ellipsoid.
module scaleOn(c, r, az, el, s, col = rock) {
  color(col) translate(onEll(c, r, az, el, -0.35)) rotate(_dir_rot(nEll(az, el))) rotate([0, 0, az * 1.7])
    scale([s, s * 0.8, 0.75]) sphere(1, $fn = 9);
}
// A flame tongue: dark red edge, orange body, yellow core, crossed with a second plate so it reads from the side.
flamePts = [[-1.5, 0], [1.5, 0], [1.9, 1.5], [1.2, 3], [1.7, 4.4], [0.8, 5.8], [1.3, 7.6], [0, 6.4], [-0.5, 4.8],
            [-1.2, 3.8], [-1.5, 5], [-2.1, 2.8]];
corePts = [[-1, 0.2], [1, 0.2], [1.2, 1.6], [0.5, 3], [0.8, 4.2], [-0.2, 3.3], [-1, 1.9]];
module flame(s = 1) {
  scale(s) for (a = [0, 90]) rotate([0, 0, a]) {
    plate(flamePts, 0.6, 0.3, lavaDeep, 0.15);
    translate([0, -0.2, 0]) plate(flamePts, 0.75, 0.3, lava, 0);
    translate([0, -0.45, 0.3]) plate(corePts, 0.45, 0.25, lavaHot, 0.1);
  }
  // Embers flicking off above.
  color(lavaDeep) translate([s * 1.4, 0, s * 8.6]) cube(s * 0.5, center = true);
}

// ---- body: an upright, massive chest and broad hips; dark red underbelly.
chestC = [-0.5, -5.5, 14.5]; chestR = [10, 8.5, 9.2];
hipC = [0, 8, 12]; hipR = [10, 9.5, 8.5];
color(rock) hull() {
  translate(chestC) scale(chestR) sphere(1, $fn = 26);
  translate(hipC) scale(hipR) sphere(1, $fn = 26);
}
color(belly) hull() {
  translate([-0.5, -4, 8.6]) scale([7.6, 6.6, 4]) sphere(1, $fn = 24);
  translate([0, 8.5, 7.6]) scale([8.2, 7.6, 3.8]) sphere(1, $fn = 24);
}
// Spine knobs: low stone bumps along the back.
for (k = [[0, -2, 23.2, 1.8], [0, 4, 21.6, 2], [0, 10, 20.6, 1.9], [0, 15, 18.4, 1.6]])
  color(rockHi) translate([k[0], k[1], k[2]]) scale([k[3], k[3] * 1.2, k[3] * 0.9]) sphere(1, $fn = 10);
// Rock scales over the back and upper flanks.
for (p = [[0, 62, 3.2], [55, 50, 2.8], [-55, 50, 2.8], [100, 38, 2.8], [-100, 38, 2.8], [140, 50, 3], [-140, 50, 3],
          [180, 62, 3], [125, 18, 2.6], [-125, 18, 2.6], [160, 25, 2.6], [-160, 25, 2.6], [90, 62, 2.6], [-90, 62, 2.6],
          [100, 0, 2.2], [-100, 0, 2.2], [145, -5, 2.2], [-145, -5, 2.2]])
  scaleOn(hipC, hipR, p[0], p[1], p[2], (p[0] + 1000) % 3 == 1 ? rockHi : rock);
for (p = [[0, 66, 2.6], [70, 48, 2.4], [-70, 48, 2.4], [110, 40, 2.4], [-110, 40, 2.4], [-20, 30, 2], [25, 5, 2],
          [-35, -15, 1.9], [10, -25, 1.8], [55, 20, 2], [-60, 15, 2]])
  scaleOn(chestC, chestR, p[0], p[1], p[2], p[0] < 0 ? rockHi : rock);

// Lava crack web: dense over the chest and shoulders, over the flanks, a band along the belly line.
cracked() {
  difference() {
    hull() {
      translate(chestC) scale(chestR + [0.14, 0.14, 0.14]) sphere(1, $fn = 36);
      translate(hipC) scale(hipR + [0.14, 0.14, 0.14]) sphere(1, $fn = 36);
    }
    hull() {
      translate(chestC) scale(chestR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
      translate(hipC) scale(hipR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
    }
  }
  union() {
    crackNet(chestC, chestR, -100, 100, -38, 58, 7, 4, 3);
    mirror_x() crackNet(hipC, hipR, 55, 170, -24, 40, 5, 3, 41);
  }
}

// ---- neck: short and thick, up and forward to the head; cracks over its sides.
neckA = [-0.5, -7, 19]; neckAR = [7.6, 6.4, 6.2];
neckB = [-2.5, -11, 24]; neckBR = [6.8, 5.6, 5.2];
color(rock) hull() {
  translate(neckA) scale(neckAR) sphere(1, $fn = 24);
  translate(neckB) scale(neckBR) sphere(1, $fn = 24);
}
cracked() {
  difference() {
    hull() {
      translate(neckA) scale(neckAR + [0.14, 0.14, 0.14]) sphere(1, $fn = 32);
      translate(neckB) scale(neckBR + [0.14, 0.14, 0.14]) sphere(1, $fn = 32);
    }
    hull() {
      translate(neckA) scale(neckAR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
      translate(neckB) scale(neckBR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
    }
  }
  crackNet(neckA, neckAR, -120, 120, -20, 55, 6, 3, 91);
}

// ---- head: big, broad and flat, raised and turned a little to its right, heavy brows, wide jaws over a dark throat.
HT = [-4, -13.5, 30]; HR = [-12, 0, -15]; HS = 1.22;
module head() {
  // Skull: broad cranium, flat top, a blunt wide snout.
  color(rock) hull() {
    translate([0, 3, 1.4]) scale([7, 5.6, 4.6]) sphere(1, $fn = 30);
    translate([0, -2.5, 1.6]) scale([6.8, 4.6, 4.4]) sphere(1, $fn = 28);
    translate([0, -8.6, 0.8]) scale([5.4, 3, 3.5]) sphere(1, $fn = 24);
  }
  // Lower jaw: wide, heavy jowls at the back.
  color(rock) hull() {
    translate([0, 1.5, -2.4]) scale([6.8, 5.2, 2.8]) sphere(1, $fn = 24);
    translate([0, -8.4, -1.6]) scale([4.6, 2.8, 1.9]) sphere(1, $fn = 20);
  }
  // Throat pouch: dark brown, sagging under the jaw towards the chest.
  color(throat) hull() {
    translate([0, -1, -4.2]) scale([5.4, 5.2, 3.2]) sphere(1, $fn = 22);
    translate([0, -6.5, -3.2]) scale([3.8, 2.6, 2]) sphere(1, $fn = 18);
    translate([0, 3.5, -5.6]) scale([4.8, 3.6, 3]) sphere(1, $fn = 18);
  }
  // Mouth: a long dark seam from cheek to cheek round the snout, turned up a little at the cheek.
  color(ink) for (s = [-1, 1]) chain(
    [[s * 6.6, 3.6, 0.3], [s * 6.9, 0.5, -0.5], [s * 6.3, -3.5, -0.7], [s * 5.2, -7.4, -0.5], [s * 3.4, -10.4, -0.3], [0, -11.5, -0.2]],
    [0.42, 0.45, 0.45, 0.42, 0.4, 0.38]);
  mirror_x() {
    // Eye: orange with a black ring and a vertical slit, under the brow.
    eye([6.1, -4.6, 2.4], 1.7, iris = lava, pupil = ink, sclera = ink, yaw = 32, flat = 0.6, lid = 0.18, lid_tilt = 12,
        lid_c = rock, slit = 0.32, shine = true);
    // Heavy brow ridge, the bump on top of the head.
    color(rock) hull() {
      translate([5, -3.8, 4.5]) scale([2.8, 2.8, 1.7]) sphere(1, $fn = 14);
      translate([2.4, -6.4, 4.1]) scale([1.6, 1.6, 1.1]) sphere(1, $fn = 10);
    }
    color(rockHi) translate([4.4, -3, 5.9]) scale([1.8, 1.8, 0.6]) sphere(1, $fn = 10);
    // Nostril.
    color(ink) translate([1.9, -11.2, 2.1]) scale([0.55, 0.4, 0.45]) sphere(1, $fn = 8);
    // Flame rising from the front corner of the skull.
    translate([3.6, -8.4, 2.6]) rotate([10, 5, 15]) flame(0.85);
    // Rock scales over the cranium.
    for (q = [[2.4, 2.5, 5.6, 1.6], [5.6, 2, 4, 1.5], [6.6, -1, 2.2, 1.3]])
      color(rockHi) translate([q[0], q[1], q[2]]) scale([q[3], q[3], q[3] * 0.45]) sphere(1, $fn = 9);
  }
  color(rockHi) translate([0, 4, 5.6]) scale([2, 2, 0.8]) sphere(1, $fn = 10);
}
translate(HT) rotate(HR) scale(HS) head();

// ---- legs: thick and splayed, elbows and knees out, four-toed clawed feet.
module foot(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(rock) hull() {
      translate([0, 0.6, 1.3]) scale([3.3, 3.2, 1.6]) sphere(1, $fn = 16);
      translate([0, -2.2, 1.1]) scale([3.6, 2, 1.1]) sphere(1, $fn = 14);
    }
    for (a = [-36, -12, 12, 36]) {
      tip = [sin(a) * 5.4, -cos(a) * 5.6, 0.7];
      limb([sin(a) * 1.5, -1.8, 1.2], tip, 1.05, 0.72, rock);
      color(claw) translate(tip + [0, 0, 0.1]) rotate(_dir_rot([sin(a) * 1, -cos(a) * 1.4, -0.55])) cylinder(h = 1.8, r1 = 0.55, r2 = 0.06, $fn = 7);
    }
  }
}
// Front legs: shoulder ball, elbow pushed out, forearm down to the foot. The near one steps forward.
FL = [[8, -8, 14], [11.8, -10, 8], [10.6, -12.6, 2.6]];
FR = [[-8, -5.5, 14], [-12.4, -7.6, 8.6], [-12, -9.6, 2.6]];
FRAD = [5.4, 4.3, 3.4];
chain(FL, FRAD, rock, $fa = 12);
chain(FR, FRAD, rock, $fa = 12);
foot([10.6, -13.4, 0], 4);
foot([-12, -10.4, 0], -22);
// Hind legs: a big haunch, a short thick shin.
mirror_x() {
  color(rock) translate([9, 9, 11.5]) scale([4.6, 6.2, 6.6]) sphere(1, $fn = 22);
  chain([[10, 8.5, 9], [12.2, 8, 5.6], [11, 9.6, 2.6]], [4.4, 3.8, 3.2], rock, $fa = 12);
  foot([11, 9, 0], -10);
  scaleOn([9, 9, 11.5], [4.6, 6.2, 6.6], 90, 25, 2.2, rockHi);
  cracked() { ellShell([9, 9, 11.5], [4.6, 6.2, 6.6], 30); crackNet([9, 9, 11.5], [4.6, 6.2, 6.6], 50, 160, -30, 40, 3, 2, 133); }
}
// Front shoulders and upper arms: a scale and cracks over each.
scaleOn(FL[0], [5.4, 5.4, 5.4], 80, 30, 2.4, rockHi);
scaleOn(FR[0], [5.4, 5.4, 5.4], -80, 30, 2.4, rockHi);
cracked() { ellShell(FL[0], [5.4, 5.4, 5.4], 30); crackNet(FL[0], [5.4, 5.4, 5.4], 0, 150, -30, 50, 3, 2, 211); }
cracked() { ellShell(FR[0], [5.4, 5.4, 5.4], 30); crackNet(FR[0], [5.4, 5.4, 5.4], -150, 0, -30, 50, 3, 2, 223); }
for (L = [FL, FR]) scaleOn(L[1], [4.3, 4.3, 4.3], L[1][0] > 0 ? 70 : -70, 0, 2, rockHi);

// ---- tail: thick at the root, out behind the near haunch, rising high; grey on top, dark red underneath, cracked.
tailPts = [[2, 13, 11], [6, 18, 8], [9.5, 20, 10], [10, 19, 14], [9, 17.5, 18], [7.5, 16.5, 21]];
tailR = [6.5, 5.2, 4.5, 3.9, 3.5, 3.1];
chain(tailPts, tailR, rock, $fa = 12);
chain([for (i = [0 : 4]) tailPts[i] + [0, 0.5, -tailR[i] * 0.35]], [for (i = [0 : 4]) tailR[i] * 0.78], belly, $fa = 14);
// Cracks: two lines along each side and rings between the stone segments.
for (side = [-1, 1], lift = [0.45, -0.25])
  chain([for (i = [0 : len(tailPts) - 1]) tailPts[i] + [side * tailR[i] * 0.86, 0, tailR[i] * lift + (i % 2 == 0 ? 0.6 : -0.6)]],
        [for (i = [0 : len(tailPts) - 1]) 0.4], lava);
for (i = [1 : len(tailPts) - 2])
  color(lava) translate(tailPts[i]) rotate(_dir_rot(tailPts[i + 1] - tailPts[i - 1])) scale([1, 1, 0.08]) sphere(tailR[i] + 0.12, $fn = 12);
// Rock scales along the tail's top.
for (i = [0 : len(tailPts) - 2]) let(m = (tailPts[i] + tailPts[i + 1]) / 2, r = (tailR[i] + tailR[i + 1]) / 2)
  color(i % 2 == 0 ? rockHi : rock) translate(m + [-r * 0.3, 0, r * 0.82]) scale([r * 0.55, r * 0.6, r * 0.3]) sphere(1, $fn = 9);
// The molten crescent: rising from the tail end, curling over and hooking back to a point; bright where it leaves the
// stone, deep red along the outer edge and at the point.
tip = [[7.5, 16.5, 21], [7.2, 16.8, 24.6], [8, 19.4, 27.2], [9.4, 22.6, 27.6], [10.6, 25.6, 26]];
tipW = [3.2, 3.6, 3.1, 2.1, 0.35];
for (i = [0 : len(tip) - 2]) color(i < 2 ? lava : lavaDeep) hull() {
  translate(tip[i]) scale([0.7, 1, 1]) sphere(tipW[i], $fn = 14);
  translate(tip[i + 1]) scale([0.7, 1, 1]) sphere(tipW[i + 1], $fn = 14);
}
// Outer rim of the crescent in dark red.
for (i = [0 : len(tip) - 2]) color(lavaDark) hull() {
  translate(tip[i] + [0, 0.5, 0.9]) scale([0.6, 0.85, 0.85]) sphere(tipW[i], $fn = 12);
  translate(tip[i + 1] + [0, 0.5, 0.9]) scale([0.6, 0.85, 0.85]) sphere(tipW[i + 1], $fn = 12);
}
// Embers dripping off the point.
for (e = [[11.2, 26, 23.4, 0.45], [11.4, 26.4, 21.4, 0.35]]) color(lavaDeep) translate([e[0], e[1], e[2]]) cube(e[3] * 2, center = true);
