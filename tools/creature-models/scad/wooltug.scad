// Wooltug: Mufflo grown into a sturdy shaggy sheep: a heavy tan-cream fleece on longer legs with dark hooves, a long
// sleepy face under a wool fringe, short curved grey horns and a bell on a leather collar.
include <lib.scad>

wool = [0.93, 0.83, 0.64];
woolShade = [0.85, 0.73, 0.54];
face = [0.96, 0.82, 0.7];
nose = [0.85, 0.6, 0.55];
horn = [0.45, 0.43, 0.4];
hornHi = [0.6, 0.58, 0.55];
leg = [0.88, 0.72, 0.62];
hoof = [0.32, 0.24, 0.18];
leather = [0.55, 0.36, 0.2];
bell = [0.72, 0.52, 0.28];

module puffs(r, c, rows, col) {
  for (p = rows) {
    az = p[0]; el = p[1];
    color(col) translate(c + [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)])
      rotate([0, 90 - el, az]) scale([1, 1, 0.55]) sphere(p[2], $fn = 14);
  }
}
function shell(n, els, s, off = 0) = [for (e = els) for (i = [0 : n - 1]) [i * 360 / n + off, e, s]];

// Fleece body: longer and heavier than Mufflo's.
bc = [0, 3, 16];
br = [11.5, 15, 9.5];
ell(br, bc, wool);
puffs(br * 0.97, bc, shell(10, [-25, 10], 5), woolShade);
puffs(br * 0.97, bc, shell(8, [42], 5, 22), wool);
puffs(br * 0.97, bc, [[0, 80, 5.5]], woolShade);
// Wool hanging down over the legs.
mirror_x() for (y = [-8, 0, 9]) color(woolShade) translate([8.5, y, 8]) scale([1, 1, 1.4]) sphere(3.4, $fn = 14);

// Legs: longer, with dark hooves.
mirror_x() for (y = [-7, 10]) {
  limb([5.5, y, 9], [5.8, y - 0.5, 2.2], 1.9, 1.5, leg);
  color(hoof) translate([5.8, y - 0.8, 0]) cylinder(h = 2.4, r1 = 2.1, r2 = 1.7, $fn = 16);
}

// Head: a long, sleepy face pushed forward.
blob([[[5.4, 5, 5.4], [0, -13, 24]], [[3.6, 3, 3], [0, -17.5, 20.8]]], face);
mirror_x() ell([0.8, 0.5, 0.6], [1.2, -20.2, 21.4], nose);
color([0.4, 0.25, 0.22]) translate([0, -20, 19.6]) scale([1.5, 0.4, 0.3]) sphere(1, $fn = 12);
// Half-lidded eyes with a heavy lid.
mirror_x() {
  eye([3, -17, 25], 1.3, iris = [0.2, 0.14, 0.1], pupil = [0.06, 0.04, 0.04], yaw = -22, flat = 0.6);
  color(face) translate([3, -17.1, 25.6]) rotate([0, 0, -22]) scale([1.7, 0.95, 0.9]) sphere(1, $fn = 14);
}
// Fringe of wool over the brow.
for (p = [[0, -14.6, 29, 3], [-3.6, -14, 28.4, 2.6], [3.6, -14, 28.4, 2.6], [0, -11, 30.4, 3.2],
          [-3.4, -10, 29.4, 2.8], [3.4, -10, 29.4, 2.8], [-1.8, -16.2, 27.6, 1.8], [1.8, -16.2, 27.6, 1.8],
          [0, -8, 26.5, 4.2], [-5.4, -12, 26, 2.2], [5.4, -12, 26, 2.2]])
  color(wool) translate([p[0], p[1], p[2]]) sphere(p[3], $fn = 16);
// Ears out to the sides.
mirror_x() petal([3, 1.3, 1.2], [7.4, -12.4, 25], [0, 15, 15], face);
// Short horns curling back and out from the sides of the crown.
mirror_x() {
  chain([[4.2, -12, 28.4], [7.4, -11.4, 30.6], [10.2, -9, 30], [10.8, -7.8, 27.4], [9.6, -9.4, 25.6]],
        [1.7, 1.5, 1.2, 0.9, 0.5], horn);
  chain([[5, -12.4, 29.6], [7.4, -11.9, 31.2]], [0.6, 0.5], hornHi);
}

// Leather collar across the chest with a hanging bell.
function collar(t) = [sin(t) * 9.6, -10.6 + (1 - cos(t)) * 7, 18.4 - (1 - cos(t)) * 3];
chain([for (t = [-70 : 20 : 70]) collar(t)], [for (t = [-70 : 20 : 70]) 0.9], leather);
color(bell) translate([0, -12.6, 13.2]) cylinder(h = 4.4, r1 = 2.4, r2 = 1.4, $fn = 16);
color(bell * 0.7) translate([0, -12.6, 13]) sphere(0.8, $fn = 8);

// Stubby tail.
ell([2.4, 2.4, 3], [0, 18, 19], woolShade);
