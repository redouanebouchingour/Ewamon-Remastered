// Scraphog: a low, wide-stanced boar armoured in layered brown stone plates (a shell of rounded slabs with dark grout
// between them), grey rubble under the shell's rim, tan stone spikes from the crown down the spine and a cluster of
// violet crystals over the middle of the back, a big low head with a wide pig snout, small angry red eyes, pointed
// ears, a big curved tusk and a small upper tusk on each side, and four splayed armoured legs on clawed hooves.
//
// Checklist (front sheet, 46 x 40):
//   head   x -17..-1, z 12..30: plated crown and brow, eyes red almonds at (-6.1, 21) and the far one at (-14.3, 21),
//          snout disc x -16..-9.5 z 13.8..18.4 with two slanted nostrils, mouth line z 13.5
//   tusks  far big crescent x -23..-15.5 z 10..18.5 (tip up), far small x -18..-15.5 z 15..20.5; the near big one
//          foreshortened to a U at x -8..-3 z 9.5..18.5
//   ears   near x -3..0 z 25..30 (dark inside), far x -14.7..-11 z 26..30
//   body   x -2..20, z 9..33: plates over the top and shoulder, grey rubble on the rear flank x 13..20 z 12..28
//   spine  tan spikes at x -8 (z 35), -4 (38), 1..3 (40); crystals x 4..10 z 28..37; a dark spike at x 13 z 30
//   legs   near front x -4..8 down to a 3-toed hoof at x 0 z 0; far front reaching out to x -18; near hind x 13..23
//   back   a domed shell of big plates, rubble at the sides, the crystal cluster tall over the middle of the back
include <lib.scad>

grout = [0.21, 0.17, 0.17];
stoneD = [0.30, 0.22, 0.22];
stoneG = [0.44, 0.37, 0.36];
rockA = [0.60, 0.41, 0.33];
rockB = [0.72, 0.45, 0.32];
rockC = [0.49, 0.34, 0.28];
rockT = [0.73, 0.54, 0.42];
spikeC = [0.82, 0.65, 0.50];
skin = [0.55, 0.37, 0.29];
snoutC = [0.72, 0.45, 0.32];
nostril = [0.15, 0.10, 0.09];
tuskC = [0.88, 0.75, 0.60];
crystalC = [0.60, 0.38, 0.60, NOGLOW];
crystalDk = [0.40, 0.23, 0.42, NOGLOW];
crystalHi = [0.85, 0.65, 0.88, NOGLOW];
eyeRed = [0.82, 0.12, 0.08, NOGLOW];
socket = [0.27, 0.17, 0.16];

PLATES = [rockA, rockB, rockC, rockA, rockT];
HEADPLATES = [rockA, rockB, rockT, rockA, rockC];
function rnd(s) = rands(0, 1, 1, s)[0];
function sdir(a, e) = [cos(e) * cos(a), cos(e) * sin(a), sin(e)];

// A pyramid from the origin through the cell az a0..a1, elevation e0..e1 (unit-sphere space, out to radius 3).
module cellWedge(a0, a1, e0, e1) {
  polyhedron([[0, 0, 0], 3 * sdir(a0, e0), 3 * sdir(a1, e0), 3 * sdir(a1, e1), 3 * sdir(a0, e1)],
    [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 4, 3, 2]]);
}
// Shingled stone plates on the ellipsoid (c, r): rows = [[e0, e1, columns, az offset, grow]]. Each plate is the cell
// of a slightly bigger ellipsoid whose centre is pushed up the slope, so its lower edge stands proud of the row below
// (layered like shingles); `skip(az, e)` leaves a cell out. Grout shows in the gaps.
module shell(c, r, rows, seed = 1, gap = 3.2, tilt = 0.08, fn = 30, pal = PLATES) {
  for (k = [0 : len(rows) - 1]) {
    row = rows[k];
    n = row[2];
    span = 360 / n;
    for (j = [0 : n - 1]) {
      a0 = row[3] + j * span + (j == 0 ? 0 : 0.22 * span * (rnd(seed * 31 + k * 7 + j) - 0.5));
      a1 = row[3] + (j + 1) * span + (j == n - 1 ? 0 : 0.22 * span * (rnd(seed * 31 + k * 7 + j + 1) - 0.5));
      em = (row[0] + row[1]) / 2;
      am = (a0 + a1) / 2;
      s = seed * 101 + k * 17 + j;
      if (!_skip(c, r, am, em)) {
        g = row[4] + 0.05 * rnd(s);
        up = [-sin(em) * cos(am), -sin(em) * sin(am), cos(em)];
        side = [-sin(am), cos(am), 0];
        off = -tilt * (0.5 + rnd(s + 5)) * up + 0.08 * (rnd(s + 7) - 0.5) * side;
        color(pal[floor(rnd(s + 3) * (len(pal) - 0.01))]) translate(c) scale(r) intersection() {
          translate(off) sphere(1 + g, $fn = fn);
          cellWedge(a0 + gap / 2, a1 - gap / 2, row[0] + gap / 2, row[1] - gap / 2);
        }
      }
    }
  }
}
// Cells to leave out, per surface (the body's underside between the legs, the head's face).
function _skip(c, r, a, e) = c == HC ? (e < 14 && (a > 228 && a < 312)) || e < -12 : e < -20 && !((a > 50 && a < 130) || (a > 222 && a < 318));

// A hexagonal crystal shard from p along d, radius r: violet with a pale tip.
module crystal(p, d, r) {
  l = norm(d);
  translate(p) rotate(_dir_rot(d)) {
    color(crystalC) cylinder(h = l * 0.72, r = r, $fn = 6);
    color(crystalHi) translate([0, 0, l * 0.72]) cylinder(h = l * 0.28, r1 = r, r2 = 0.08, $fn = 6);
  }
}
// An armour sleeve along a leg segment: a faceted stone cylinder over the part t0..t1 (0..1) of p1 -> p2, radius r,
// narrowing to r * k at its lower end.
module band(p1, p2, t0, t1, r, k, c) {
  d = p2 - p1;
  color(c) translate(p1 + d * t0) rotate(_dir_rot(d)) cylinder(h = norm(d) * (t1 - t0), r1 = r, r2 = r * k, $fn = 9);
}

// A faceted rubble stone (low-poly so it reads as broken rock, not a ball).
module rubble(r, p, c, a = 0) { color(c) translate(p) rotate([0, 0, p[1] > 20 ? 30 : 0]) scale(r) rotate([a * 0.6, a, a * 1.7]) sphere(1, $fn = 7); }

// ---- Body: a long, low domed barrel of grout under a shell of shingled plates.
BC = [0, 8.5, 18.8];
BR = [12, 14.6, 11];
ell(BR, BC, grout);
shell(BC, BR, [[-40, -14, 9, 0, 0.05], [-14, 12, 9, 15, 0.07], [12, 38, 8, 5, 0.09], [38, 64, 6, 25, 0.1], [64, 86, 4, 0, 0.11]], 1);
// Grey rubble under the shell's rim: the rear flanks and the shoulders' undersides.
mirror_x() for (s = [[[2, 3.6, 3.2], [10.6, 15.5, 15.4], stoneD, 20], [[1.8, 3.2, 3], [10.2, 19.8, 18], stoneG, 50],
                     [[1.8, 3, 2.8], [8.6, 23, 20.5], stoneD, 80], [[1.8, 3.2, 2.8], [11.6, 10.5, 16.2], stoneG, 35],
                     [[1.8, 3, 2.6], [11, 3, 13.4], stoneD, 65], [[1.6, 2.6, 2.4], [11.8, 6.8, 13.6], stoneG, 10]])
  rubble(s[0], s[1], s[2], s[3]);

// ---- Neck: the head hangs low in front of the shoulders.
ell([7.5, 7, 6.5], [0, -6, 20.5], grout);
shell([0, -6, 20.5], [7.5, 7, 6.5], [[10, 40, 7, 10, 0.1], [40, 75, 5, 0, 0.12]], 3);

// ---- Head: big, broad and low, plated over the crown and brow.
HC = [0, -15.5, 22];
HR = [9, 8.6, 7.6];
ell(HR, HC, skin);
shell(HC, HR, [[-12, 14, 9, 0, 0.06], [14, 40, 8, 4, 0.08], [40, 64, 6, 20, 0.1], [64, 86, 4, 45, 0.11]], 2, gap = 4, pal = HEADPLATES);
// The face below the brow: a broad muzzle sloping to the snout.
blob([[[6.6, 3, 5], [0, -20.6, 19]], [[5.2, 2.6, 3.8], [0, -23.6, 17.6]]], skin);
// Snout: a wide disc facing forward with two slanted nostrils.
color(snoutC) translate([0, -25.4, 17.4]) rotate([94, 0, 0]) scale([4.4, 3.2, 1]) cylinder(h = 2.4, r = 1, center = true, $fn = 28);
mirror_x() color(nostril) translate([1.65, -26.6, 17.5]) rotate([0, 18, 0]) scale([0.6, 0.3, 1.35]) sphere(1, $fn = 12);
// Lower jaw and mouth line.
color(rockC) translate([0, -21.5, 14]) scale([5.2, 4.4, 2]) sphere(1, $fn = 18);
color(nostril) translate([0, -22.3, 15.2]) scale([4.8, 3.4, 0.35]) sphere(1, $fn = 18);

mirror_x() {
  // Eyes: small red almonds in a dark socket, hooded by an angry lid sloping down to the snout.
  eye([5.4, -21.4, 22.8], 1.6, iris = eyeRed, pupil = [0.2, 0.03, 0.02], sclera = socket, yaw = 38, flat = 0.42,
      shine = true, lid = 0.38, lid_tilt = 30, lid_c = stoneD, slit = 0.5);
  // Heavy brow plate over each eye, slanting down towards the snout.
  color(rockT) hull() {
    translate([6.8, -19.4, 26]) scale([1.9, 1.5, 1]) sphere(1, $fn = 12);
    translate([2.4, -22.4, 25]) scale([1.3, 1.2, 0.8]) sphere(1, $fn = 12);
  }
  // Ears: pointed stone wedges with a dark inside, pricked up and out.
  color(rockA) hull() {
    translate([5.6, -12.5, 28.4]) scale([2.5, 1.6, 1.1]) sphere(1, $fn = 12);
    translate([8.6, -13, 33]) sphere(0.25, $fn = 8);
  }
  color(stoneD) hull() {
    translate([5.9, -14, 28.7]) scale([1.5, 0.5, 0.7]) sphere(1, $fn = 10);
    translate([8.3, -13.3, 32.2]) sphere(0.15, $fn = 6);
  }
  // Big tusk: out of the jaw beside the snout, sweeping out and forward and curling up to a point.
  chain([[3.8, -22, 16.4], [6.4, -23, 13.2], [9.8, -24, 12.8], [12.6, -25, 15], [13.6, -25.6, 18.6], [13, -25.4, 22.4]], [1.9, 1.85, 1.7, 1.4, 0.9, 0.2], tuskC);
  // Small upper tusk: from the upper lip, up and out beside the snout.
  chain([[3.8, -23.4, 17.4], [5.8, -24.8, 19.8], [7, -25.4, 22.8]], [0.95, 0.65, 0.1], tuskC);
}

// ---- Spine: tan stone spikes from the crown to the shoulders, violet crystals over the middle of the back.
for (s = [[[0, -16, 28.5], [0, 1, 8], 2.4], [[0, -9.5, 27.5], [0, 1, 10], 2.8], [[0, -3, 29], [0, 0.8, 11], 3],
          [[0, 3, 29.6], [0, 0.8, 7], 2.1], [[0, 24, 24], [0, 1.6, 4], 1.5]])
  spike(s[0], s[1], s[2], 0.1, spikeC);
mirror_x() for (s = [[[2.6, -6, 27.5], [1, 0.3, 4.6], 1.5], [[3.2, 1, 29], [1.5, 0.4, 4.2], 1.3], [[8.6, 17, 25], [1.6, 1.2, 3.6], 1.3]])
  spike(s[0], s[1], s[2], 0.1, s[0][1] > 10 ? stoneD : rockT);
crystal([0, 8, 29.5], [0, 0.4, 9.5], 1.35);
crystal([1.8, 6, 29.4], [1.6, -0.8, 7.5], 1.1);
crystal([-1.6, 10.5, 29.4], [-1.8, 0.8, 8.6], 1.2);
crystal([1.4, 12.5, 29], [1.6, 1.4, 7.2], 1.05);
crystal([-1.2, 14.8, 28.4], [-0.8, 2.2, 6.4], 1.0);
crystal([2.6, 9.5, 29.2], [3, 0, 5.4], 0.85);
crystal([-2.8, 6.5, 29.2], [-3, -0.6, 5.2], 0.85);
crystal([0.4, 17.5, 27.6], [0.4, 2.2, 5], 0.9);
crystal([-3.4, 13.5, 28], [-2.6, 1, 4.2], 0.75);
crystal([3.8, 14.5, 27.6], [2.6, 1.4, 4.2], 0.75);

// ---- Legs: short, splayed wide, armoured in stone bands over dark stone, on three-toed grey hooves.
LEGS = [[[8.5, -3, 12], [11.4, -9, 6.6], [12, -14, 2.6]], [[8.5, 18, 12], [12, 22, 6.8], [12.8, 23.8, 2.6]]];
mirror_x() for (L = LEGS) {
  hip = L[0]; knee = L[1]; ank = L[2];
  chain([hip, knee, ank], [4.4, 3.6, 3], stoneD);
  band(hip, knee, 0.08, 0.8, 5, 0.86, rockA);
  band(knee, ank, 0.2, 0.86, 4, 0.86, rockB);
  color(rockT) translate(knee + [0.5, -0.6, 0.2]) scale([4.4, 4.2, 3.4]) sphere(1, $fn = 9);
  // Hoof and toes.
  color(stoneG) translate(ank + [0, -0.6, -1.1]) scale([3.2, 3.4, 1.6]) sphere(1, $fn = 16);
  for (a = [-28, 0, 28]) color(stoneD)
    translate(ank + [sin(a) * 2.3, -3, -1.6]) rotate([0, 0, a]) scale([1, 1.8, 1]) sphere(1, $fn = 10);
}

// ---- Tail: a short stone stub at the rump.
chain([[0, 24.5, 20], [0, 27, 20.6], [0.6, 28, 19.2]], [1.1, 0.8, 0.3], rockC);
