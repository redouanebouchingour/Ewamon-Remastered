// Magmolith: Embrock grown into a hulking stone kaiju iguana on four thick clawed legs, a big blunt head with a heavy
// brow over a small glaring lava eye, a row of tall jagged stone spikes down its back, a hide webbed with glowing lava
// cracks and a long tail that rises in an S and hooks over into a molten tip dripping lava.
//
// Checklist (front sheet, 40 units; parts further back read about 0.17 z per unit of depth higher on the sheet):
//   head      x -24.8..-8, z 23.5..38: big and blunt, side-on, snout to the viewer's left; flat brow line rising from
//             the snout (z 32.5) to the crown (z 38); square blunt snout front z 25..31.5
//   eye       x -16.3..-14, z 31..33: small, orange with a hot yellow core, a dark slit, under a heavy dark brow
//             slanting over it (an angry glare). The far eye shows in the back art (two eyes).
//   mouth     a long dark line z 27.5 from the snout to x -16, curling up to z 30 at the cheek (x -11); a nostril at
//             x -21, z 30.4; dark brown jaw underside / throat z 23..25.5
//   spikes    tall jagged stone spikes on the spine, tips: (-8, 40) (-4.5, 39) (-0.5, 36.5) (3.5, 37.6) (7, 32.4)
//             (9.1, 28.3) (11, 25); small knobs on the crown; a lower jagged row on the flanks in the back art
//   chest     huge, x -16..5, z 9..27, a dense web of glowing cracks over the chest, neck and shoulders
//   belly     dark red-brown underside z 8..11
//   legs      thick, rock-plated, four-toed clawed feet: far front splayed forward x -24.4..-14 (toes to the left),
//             near front x -8.5..6 (lowest, under the shoulder boulder), near hind x 10..19.5 (big plated thigh),
//             far hind dark under the belly x -8.5..-1
//   tail      thick root behind the hips, out to x 25 at z 16..22, rising and narrowing to x 11.6..17 at z 29..33,
//             then hooking over to the right (x 14..23.6, z 31..38.8): the hook molten red-brown, three lava drips
//             hanging from it; cracked all over, red-brown between grey stone plates
//   back      spikes, the crack web over the back and shoulders, the cracked tail; no other marking
include <lib.scad>

rock = [0.41, 0.38, 0.34];
rockHi = [0.54, 0.51, 0.45];
rockDark = [0.27, 0.22, 0.21];
throat = [0.29, 0.21, 0.2];
belly = [0.33, 0.17, 0.14];
ink = [0.08, 0.05, 0.04];
lava = [0.95, 0.4, 0.12, GLOW];
lavaHot = [0.98, 0.55, 0.18, GLOW];
lavaDeep = [0.62, 0.2, 0.08, NOGLOW];
lavaDark = [0.42, 0.13, 0.07, NOGLOW];
claw = [0.6, 0.57, 0.5];

// ---- helpers (Embrock's crack technique)
function rnd(i) = let(v = sin(i * 12.9898 + 78.233) * 43758.5453) v - floor(v);
// Point on an ellipsoid (centre c, radii r) at azimuth az (0 = -Y front, 90 = +X) and elevation el, pushed out by g.
function onEll(c, r, az, el, g = 0.3) =
  [c[0] + (r[0] + g) * cos(el) * sin(az), c[1] - (r[1] + g) * cos(el) * cos(az), c[2] + (r[2] + g) * sin(el)];
function nEll(az, el) = [cos(el) * sin(az), -cos(el) * cos(az), sin(el)];
// One crack: a thin fan from the centre through two surface points; cut by a thin shell it leaves a line on the skin.
module crackSeg(c, r, a, b, w) {
  hull() {
    translate(c) sphere(w / 2, $fn = 6);
    translate(c + (onEll(c, r, a[0], a[1], 0) - c) * 1.6) sphere(w / 2, $fn = 6);
    translate(c + (onEll(c, r, b[0], b[1], 0) - c) * 1.6) sphere(w / 2, $fn = 6);
  }
}
module cracked() { color(lava) intersection() { children(0); union() children(1); } }
module ellShell(c, r, fn = 24) {
  difference() {
    translate(c) scale(r + [0.14, 0.14, 0.14]) sphere(1, $fn = fn);
    translate(c) scale(r - [0.8, 0.8, 0.8]) sphere(1, $fn = 14);
  }
}
// A jittered grid of nodes over an az / el window, its edges dropped at random so the cells read as stone plates.
module crackNet(c, r, az0, az1, el0, el1, na, ne, seed, w = 0.55, keep = 0.72, diag = 0.5) {
  function node(i, j) = [az0 + (az1 - az0) * (i + (i > 0 && i < na ? 0.75 * (rnd(seed + i * 31 + j * 17) - 0.5) : 0)) / na,
                         el0 + (el1 - el0) * (j + (j > 0 && j < ne ? 0.75 * (rnd(seed + i * 13 + j * 29 + 5) - 0.5) : 0)) / ne];
  for (i = [0 : na], j = [0 : ne]) {
    if (i < na && j > 0 && rnd(seed + i * 7 + j * 11 + 1) < keep) crackSeg(c, r, node(i, j), node(i + 1, j), w);
    if (j < ne && rnd(seed + i * 5 + j * 19 + 2) < keep) crackSeg(c, r, node(i, j), node(i, j + 1), w);
    if (i < na && j < ne && rnd(seed + i * 23 + j * 3 + 4) < diag) let(f = rnd(seed + i * 3 + j * 23 + 6) < 0.5)
      crackSeg(c, r, node(i, f ? j : j + 1), node(i + 1, f ? j + 1 : j), w);
  }
}
// A low rock plate lying on an ellipsoid.
module scaleOn(c, r, az, el, s, col = rock, fn = 9) {
  color(col) translate(onEll(c, r, az, el, -0.35)) rotate(_dir_rot(nEll(az, el))) rotate([0, 0, az * 1.7])
    scale([s, s * 0.8, 0.85]) sphere(1, $fn = fn);
}
// A rounded box: centre c, half-sizes h, corner radius r (a blocky skull or jaw).
module rbox(c, h, r, fn = 12) {
  hull() for (sx = [-1, 1], sy = [-1, 1], sz = [-1, 1])
    translate(c + [sx * (h[0] - r), sy * (h[1] - r), sz * (h[2] - r)]) sphere(r, $fn = fn);
}
// A jagged stone spike: a faceted blade from a base long along the spine (half-length len, half-width w) to tip t.
module spikeBlade(p, t, len, w, col = rock) {
  color(col) hull() {
    translate(p) scale([w, len, 1.2]) sphere(1, $fn = 6);
    translate(p + (t - p) * 0.45 + [0, -len * 0.1, 0]) scale([w * 0.6, len * 0.7, 0.6]) sphere(1, $fn = 5);
    translate(t) sphere(0.2, $fn = 5);
  }
}

// ---- body: a huge chest carried high, the back falling to lower hips; dark red-brown underbelly.
chestC = [0, -7, 19]; chestR = [11.5, 9.5, 11];
hipC = [0, 11, 13]; hipR = [10.5, 9.5, 9.2];
color(rock) hull() {
  translate(chestC) scale(chestR) sphere(1, $fn = 30);
  translate(hipC) scale(hipR) sphere(1, $fn = 30);
}
color(belly) hull() {
  translate([0, -5, 10]) scale([8.8, 7.6, 4]) sphere(1, $fn = 24);
  translate([0, 11, 6.6]) scale([8.6, 8, 3.6]) sphere(1, $fn = 24);
}
// Rough stone plates: low flattened bumps all over the back, flanks and haunches, fewer over the cracked chest.
mirror_x() {
  for (az = [50 : 26 : 180], el = [-2, 26, 54]) let(k = az * 7 + el)
    scaleOn(hipC, hipR, az + 10 * (rnd(k) - 0.5), el + 8 * (rnd(k + 3) - 0.5), 2.2 + 0.8 * rnd(k + 5), rnd(k + 9) < 0.4 ? rockHi : rock, 8);
  for (az = [62 : 30 : 152], el = [8, 38, 66]) let(k = az * 5 + el + 1)
    scaleOn(chestC, chestR, az + 10 * (rnd(k) - 0.5), el + 8 * (rnd(k + 3) - 0.5), 2 + 0.7 * rnd(k + 5), rnd(k + 9) < 0.4 ? rockHi : rock, 8);
}
for (p = [[-30, 30, 2], [25, 50, 2], [-10, 70, 2.2]]) scaleOn(chestC, chestR, p[0], p[1], p[2], rockHi, 8);

// Lava crack web: dense over the chest, shoulders and back, a band over the flanks.
cracked() {
  difference() {
    hull() {
      translate(chestC) scale(chestR + [0.14, 0.14, 0.14]) sphere(1, $fn = 30);
      translate(hipC) scale(hipR + [0.14, 0.14, 0.14]) sphere(1, $fn = 30);
    }
    hull() {
      translate(chestC) scale(chestR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
      translate(hipC) scale(hipR - [0.8, 0.8, 0.8]) sphere(1, $fn = 16);
    }
  }
  union() {
    crackNet(chestC, chestR, -120, 110, -45, 80, 9, 5, 3, 0.8, 0.8);
    mirror_x() crackNet(hipC, hipR, 55, 175, -20, 70, 5, 3, 41, 0.6);
  }
}

// ---- neck: short and massive, rising from the chest to the head, turned to the creature's right; cracked.
neckA = [0, -11, 24]; neckAR = [9.5, 8, 8.2];
neckB = [-3.5, -15.5, 27.5]; neckBR = [8, 6.8, 7];
color(rock) hull() {
  translate(neckA) scale(neckAR) sphere(1, $fn = 26);
  translate(neckB) scale(neckBR) sphere(1, $fn = 26);
}
cracked() {
  difference() {
    hull() {
      translate(neckA) scale(neckAR + [0.14, 0.14, 0.14]) sphere(1, $fn = 26);
      translate(neckB) scale(neckBR + [0.14, 0.14, 0.14]) sphere(1, $fn = 26);
    }
    hull() {
      translate(neckA) scale(neckAR - [0.8, 0.8, 0.8]) sphere(1, $fn = 14);
      translate(neckB) scale(neckBR - [0.8, 0.8, 0.8]) sphere(1, $fn = 14);
    }
  }
  crackNet(neckA, neckAR, -150, 110, -50, 50, 8, 4, 91, 0.8, 0.8);
}

// ---- head: compact and blocky, set high and close on the neck; a heavy squared skull with a flat brow sloping to
// a blunt snout, a heavy brow ridge over a small glaring lava eye, a squared jaw, rough plate bumps all over.
HT = [-4.6, -18, 27]; HR = [-2, 0, -40]; HS = 1.12;
module head() {
  // Skull: a tall square crown and a blunt square snout, hulled so the brow line slopes down to the snout.
  color(rock) hull() {
    rbox([0, 2.4, 4.2], [6.4, 5.4, 6.2], 3);
    rbox([0, -6.2, 2], [5, 4.8, 3.8], 2.4);
  }
  // Lower jaw: squared, wide at the back.
  color(rock) hull() {
    rbox([0, 2, -2.6], [6, 4.2, 2.3], 1.4, 10);
    rbox([0, -7.2, -2.2], [4.6, 3.2, 1.8], 1.2, 10);
  }
  // Throat: dark brown under the back of the jaw, down into the neck.
  color(throat) hull() {
    translate([0, 1.5, -4.4]) scale([5.4, 5, 2.6]) sphere(1, $fn = 20);
    translate([0, 5.5, -5.8]) scale([5, 3.8, 2.6]) sphere(1, $fn = 18);
  }
  // Mouth: a dark seam round the snout, curling up at the cheek.
  color(ink) for (s = [-1, 1]) chain(
    [[0, -10.95, -0.5], [s * 3.8, -10.4, -0.5], [s * 4.95, -6, -0.6], [s * 5.4, -2.4, -0.6], [s * 6.3, 0.6, 0], [s * 6.4, 3, 1.2]],
    [0.42, 0.42, 0.45, 0.45, 0.42, 0.3]);
  mirror_x() {
    // Eye: small, orange with a dark slit, glaring from under the brow.
    eye([5.5, -2.6, 4.6], 1.35, iris = lava, pupil = ink, sclera = lavaDeep, yaw = 62, flat = 0.6, lid = 0.32,
        lid_tilt = 22, lid_c = rockDark, slit = 0.3);
    // Heavy brow ridge over the eye, running forward along the snout's top edge.
    color(rock) hull() {
      translate([5.3, -1.2, 7]) scale([2.2, 2.4, 1.4]) sphere(1, $fn = 10);
      translate([4.2, -6.8, 5.6]) scale([1.5, 1.8, 1]) sphere(1, $fn = 8);
    }
    color(rockDark) hull() {
      translate([6, -2, 6]) scale([0.8, 2, 0.5]) sphere(1, $fn = 8);
      translate([5.3, -5.4, 4.9]) scale([0.6, 1, 0.4]) sphere(1, $fn = 8);
    }
    // Nostril.
    color(ink) translate([2, -10.9, 3]) scale([0.6, 0.4, 0.45]) sphere(1, $fn = 8);
    // Rough plate bumps over the crown, cheeks and snout.
    for (q = [[2.8, 3, 10.2, 1.7], [3.6, 6.4, 9.6, 1.4], [2.2, -6, 5.6, 1.3]])
      color(rockHi) translate([q[0], q[1], q[2]]) scale([q[3], q[3], q[3] * 0.4]) sphere(1, $fn = 8);
    for (q = [[6.35, 3.4, 4.2, 1.6], [6.35, 5, 0.6, 1.3], [5, -6.6, 2.4, 1.3], [6.3, 0.4, 1.6, 1.1]])
      color(q[1] > 2 ? rockHi : rock) translate([q[0], q[1], q[2]]) scale([q[3] * 0.4, q[3], q[3] * 0.85]) sphere(1, $fn = 8);
  }
  color(rockHi) translate([0, -0.6, 10.2]) scale([1.6, 1.6, 0.6]) sphere(1, $fn = 8);
}
translate(HT) rotate(HR) scale(HS) head();

// ---- dorsal spikes: a row of tall jagged stone blades down the spine, tallest over the shoulders, falling with the
// back to the rump; a lower row of smaller ones down each flank. [base y, base z, tip y, tip z, half-length, half-width]
for (s = [[-6.5, 30.5, -4.5, 36.6, 3.4, 1.9], [0, 27.6, 2.5, 33.2, 3.6, 2], [5, 25.4, 7.5, 34, 4.4, 2.3],
          [11, 22.6, 13.4, 28.5, 3.6, 2], [15, 21, 17, 24.8, 2.8, 1.6], [18.5, 18.6, 20.2, 21.4, 2, 1.2]])
  spikeBlade([0, s[0], s[1] - 1.2], [0, s[2], s[3]], s[4], s[4] * 0.8, (s[0] > 0 && s[0] < 15) ? rockHi : rock);
mirror_x() for (s = [[-8, 28.8, 5], [-2, 27.2, 5.5], [5, 24.6, 5.5], [11, 21.8, 4.5], [15.5, 19.6, 3.5]])
  spikeBlade([4.6, s[0], s[1] - 1.4], [6, s[0] + 2, s[1] + s[2]], 2.8, 2.2, rock);

// ---- legs: thick, rock-plated, elbows and knees out, four-toed clawed feet.
module foot(p, yaw) {
  translate(p) rotate([0, 0, yaw]) {
    color(rock) hull() {
      translate([0, 0.6, 1.5]) scale([4, 3.8, 1.9]) sphere(1, $fn = 16);
      translate([0, -2.6, 1.2]) scale([4.3, 2.4, 1.2]) sphere(1, $fn = 14);
    }
    for (a = [-38, -13, 13, 38]) {
      tip = [sin(a) * 6, -cos(a) * 6.2, 0.75];
      limb([sin(a) * 1.6, -1.9, 1.2], tip, 1.15, 0.78, rock, $fn = 10);
      color(claw) translate(tip + [0, 0, 0.1]) rotate(_dir_rot([sin(a), -cos(a) * 1.4, -0.55])) cylinder(h = 2, r1 = 0.6, r2 = 0.06, $fn = 7);
    }
  }
}
// Front legs: a shoulder boulder, then a thick, short leg straight down under it to the foot.
FL = [[8.6, -10, 16], [11.6, -9.4, 9], [10.2, -13.4, 3.2]];
FR = [[-8.6, -12, 16], [-11.8, -13.6, 9], [-11.4, -18, 3.2]];
FRAD = [7.4, 5.6, 4.8];
chain(FL, FRAD, rock, $fn = 22);
chain(FR, FRAD, rock, $fn = 22);
foot([10.2, -14.4, 0], 4);
foot([-11.4, -19, 0], -20);
// Hind legs: a big plated haunch, a short thick shin.
HIP = [9, 11, 12]; HIPR = [5.6, 7.2, 7.6];
mirror_x() {
  color(rock) translate(HIP) scale(HIPR) sphere(1, $fn = 22);
  chain([[10, 11.6, 8.6], [11.4, 12.6, 5.2], [10.6, 11.4, 3]], [5.6, 5, 4.4], rock, $fn = 20);
  foot([10.6, 11, 0], -4);
  scaleOn(HIP, HIPR, 90, 15, 3, rockHi);
  scaleOn(HIP, HIPR, 125, 45, 2.4, rock);
  scaleOn(HIP, HIPR, 60, -10, 2.2, rock, 8);
  cracked() { ellShell(HIP, HIPR); crackNet(HIP, HIPR, 40, 170, -35, 45, 4, 2, 133); }
  scaleOn([11.4, 12.6, 5.2], [5, 5, 5], 95, 0, 2.2, rockHi, 8);
}
// Shoulder boulders: a big round plate and cracks over each, plates down each leg.
for (L = [FL, FR]) let(sd = L[0][0] > 0 ? 1 : -1) {
  scaleOn(L[0], [7.4, 7.4, 7.4], sd * 80, 20, 3.4, rockHi);
  scaleOn(L[0], [7.4, 7.4, 7.4], sd * 40, 50, 2.6, rock, 8);
  scaleOn(L[1], [5.6, 5.6, 5.6], sd * 75, 0, 2.6, rockHi, 8);
  scaleOn(L[1], [5.6, 5.6, 5.6], sd * 20, -10, 2.2, rock, 8);
}
cracked() { ellShell(FL[0], [7.4, 7.4, 7.4]); crackNet(FL[0], [7.4, 7.4, 7.4], 0, 160, -30, 55, 4, 2, 211); }
cracked() { ellShell(FR[0], [7.4, 7.4, 7.4]); crackNet(FR[0], [7.4, 7.4, 7.4], -160, 0, -30, 55, 4, 2, 223); }

// ---- tail: a thick root behind the hips, swinging out and rising in an S, then hooking over backwards into a molten
// tip. Grey stone webbed with glowing cracks; only the hooked tip is molten.
tailPts = [[2, 18, 14], [5.2, 22.5, 13], [6.6, 22, 16.4], [4.4, 21, 20.4], [2.2, 20, 23.8], [1, 19.5, 26.8], [2, 20, 29.9]];
tailR = [5.6, 4.7, 4.3, 4, 3.5, 3, 2.7];
chain(tailPts, tailR, rock, $fn = 22);
// Cracks: a net over each link's skin.
for (i = [0 : len(tailPts) - 2]) let(a = tailPts[i], b = tailPts[i + 1], m = (a + b) / 2, d = b - a, L = norm(d),
                                    r = (tailR[i] + tailR[i + 1]) / 2)
  color(lava) intersection() {
    difference() {
      hull() { translate(a) sphere(tailR[i] + 0.25, $fn = 14); translate(b) sphere(tailR[i + 1] + 0.25, $fn = 14); }
      hull() { translate(a) sphere(tailR[i] - 0.9, $fn = 10); translate(b) sphere(tailR[i + 1] - 0.9, $fn = 10); }
    }
    translate(m) rotate(_dir_rot(d)) crackNet([0, 0, 0], [r * 1.05, r * 1.05, L / 2 + r * 0.2], -180, 180, -55, 55, 4, 2, 300 + i * 17, 0.55, 0.75, 0.35);
  }
// The hook: curls over backwards, molten red-orange, lava drips hanging from its underside.
hook = [[2, 20, 29.9], [5.2, 21, 31], [7.9, 22, 29.5], [8.9, 22.5, 27.1]];
hookR = [2.7, 2.5, 2.2, 1.6];
chain(hook, hookR, lavaDark, $fn = 16);
chain([for (i = [0 : 2]) hook[i] + [0.2, 0.2, -hookR[i] * 0.3]], [for (i = [0 : 2]) hookR[i] * 0.86], lavaDeep, $fn = 14);
ell([1.3, 1.3, 1.5], hook[3] + [0, 0, -0.7], lava);
for (d = [[3.6, 20.5, 28, 2.6, 0.55], [5.3, 21.1, 28.8, 3, 0.6], [8.9, 22.5, 25.8, 1.4, 0.5]]) {
  limb([d[0], d[1], d[2]], [d[0], d[1], d[2] - d[3]], d[4], d[4] * 0.7, lava);
  color(lavaHot) translate([d[0], d[1], d[2] - d[3] - 0.4]) sphere(d[4] * 0.8, $fn = 10);
}
color(lavaDeep) translate([5.3, 21.1, 24.4]) cube(0.8, center = true);
