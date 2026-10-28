// Rambull: Wooltug risen onto its hind legs as a hulking ram brawler: a barrel chest and huge shoulders under a cream
// shag, heavy arms ending in dark hooves, digitigrade legs and great dark spiral horns around a long, smug face.
include <lib.scad>

wool = [0.93, 0.83, 0.64];
woolShade = [0.84, 0.72, 0.53];
face = [0.96, 0.84, 0.72];
nose = [0.85, 0.6, 0.55];
horn = [0.3, 0.29, 0.26];
hornRing = [0.45, 0.43, 0.38];
skin = [0.8, 0.64, 0.54];
hoof = [0.36, 0.26, 0.2];

module puffs(r, c, rows, col) {
  for (p = rows) {
    az = p[0]; el = p[1];
    color(col) translate(c + [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)])
      rotate([0, 90 - el, az]) scale([1, 1, 0.55]) sphere(p[2], $fn = 14);
  }
}
function shell(n, els, s, off = 0) = [for (e = els) for (i = [0 : n - 1]) [i * 360 / n + off, e, s]];

// Torso: a broad barrel chest over a heavy belly.
blob([[[10, 7.5, 8], [0, 0, 22]], [[12, 8, 6], [0, 0.5, 27]], [[8, 7, 6], [0, 0, 16]]], wool);
// Pecs and belly muscles.
mirror_x() ell([5, 2.6, 3.6], [4.2, -6.4, 26], wool);
// Chest shag: a V of tufts down the front.
mirror_x() chain([[8, -6.4, 29], [4, -7.6, 25.5], [0.2, -7.8, 22]], [1.2, 1.1, 0.9], woolShade);

// Great shoulders and arms hanging forward, ending in hooves.
mirror_x() {
  ell([5, 5, 5], [11.5, 0, 27], wool);
  ell([4, 4, 5], [14, -1, 21], wool);
  chain([[13.5, -1, 19], [14.5, -4, 14], [14.5, -5, 11]], [3.6, 3.2, 2.8], wool);
  ell([3.4, 3.4, 2.4], [14.5, -5, 13], woolShade);
  color(hoof) translate([14.5, -5, 7.6]) cylinder(h = 3.6, r1 = 2.2, r2 = 2.8, $fn = 16);
}

// Legs: thick thighs, slim digitigrade shins, dark hooves.
mirror_x() {
  ell([4.6, 5, 5.5], [6, 1, 12], wool);
  chain([[6.5, 1, 9], [7, 3.5, 4.5], [7, 1.5, 1.4]], [3, 1.8, 1.5], skin);
  color(hoof) translate([7, 1, 0]) cylinder(h = 2.4, r1 = 2.1, r2 = 1.7, $fn = 16);
}

translate([0, -5, 33]) scale(1.2) translate([0, 5, -33]) {
// Head: a long, smug ram face.
blob([[[4.6, 4.8, 5], [0, -4, 33]], [[3, 3, 3], [0, -9.5, 30]]], face);
mirror_x() ell([0.7, 0.4, 0.5], [1, -12.4, 30.6], nose);
color([0.4, 0.25, 0.22]) translate([0, -12.2, 28.8]) rotate([0, 6, 0]) scale([1.6, 0.4, 0.3]) sphere(1, $fn = 12);
mirror_x() {
  eye([2.6, -8, 34], 1.2, iris = [0.25, 0.16, 0.1], pupil = [0.06, 0.04, 0.04], yaw = -22, flat = 0.6);
  color(face) translate([2.6, -8.2, 34.7]) rotate([0, -12, -22]) scale([1.6, 0.9, 0.8]) sphere(1, $fn = 14);
}
}
// Wool topknot.
for (p = [[0, -5, 38, 2.8], [-2.4, -3, 38, 2.4], [2.4, -3, 38, 2.4], [0, -1, 36.4, 2.8]])
  color(wool) translate([p[0], p[1], p[2]]) sphere(p[3], $fn = 14);
// Spiral horns curling back, down and forward around each side of the head.
// Local coil: axis u points outward and forward, v back and outward, so the coil shows from the front three-quarter.
function spiral(t) = let(a = -30 + t * 380, r = 6.4 - t * 4.2, l = [t * 3, r * sin(a), r * cos(a)], k = 45,
  u = [cos(k), -sin(k), 0], v = [sin(k), cos(k), 0]) [7.4, -2.4, 32.6] + l[0] * u + l[1] * v + [0, 0, l[2]];
hornPts = [for (i = [0 : 11]) spiral(i / 11)];
hornRs = [for (i = [0 : 11]) 2.6 - i * 0.18];
mirror_x() {
  chain(hornPts, hornRs, horn);
  for (i = [1 : 2 : 9]) color(hornRing) translate(hornPts[i]) sphere(hornRs[i] * 1.04, $fn = 12);
}
// Ears tucked under the horns.
mirror_x() petal([2.6, 1, 1], [6, -6.4, 31], [0, 20, 30], face);

// Short wool tail.
ell([2.4, 2.4, 3], [0, 7.6, 16], woolShade);
