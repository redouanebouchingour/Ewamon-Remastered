// Mufflo: a round lamb that is almost all fleece: a cream wool ball on four short pink legs, a small pink face peeking
// out from a woolly fringe, floppy pale ears and a little curled tail.
include <lib.scad>

wool = [0.96, 0.92, 0.8];
woolShade = [0.9, 0.85, 0.72];
face = [0.98, 0.84, 0.78];
nose = [0.95, 0.62, 0.6];
ear = [0.88, 0.88, 0.88];
earIn = [0.96, 0.78, 0.74];
leg = [0.96, 0.78, 0.74];

// Soft puffs of wool over an ellipsoid shell (radii r, centre c), rows of [azimuth, elevation, size].
module puffs(r, c, rows, col) {
  for (p = rows) {
    az = p[0]; el = p[1];
    color(col) translate(c + [r[0] * cos(el) * cos(az), r[1] * cos(el) * sin(az), r[2] * sin(el)])
      rotate([0, 90 - el, az]) scale([1, 1, 0.55]) sphere(p[2], $fn = 14);
  }
}
function shell(n, els, s, off = 0) = [for (e = els) for (i = [0 : n - 1]) [i * 360 / n + off, e, s]];

// Fleece body.
bc = [0, 3, 12.5];
br = [12, 13, 9.5];
ell(br, bc, wool);
puffs(br * 0.97, bc, shell(9, [-20, 15], 5), woolShade);
puffs(br * 0.97, bc, shell(7, [45], 5, 25), wool);
puffs(br * 0.97, bc, [[0, 80, 5.5]], woolShade);

// Legs: short pink stubs.
mirror_x() for (y = [-4, 10]) {
  limb([6, y, 5], [6, y, 1.2], 2.1, 1.9, leg);
  ell([2.1, 2.3, 1.1], [6, y - 0.3, 1.1], [0.86, 0.64, 0.6]);
}

// Head: a pink face at the front, framed by a woolly fringe.
ell([5.6, 5, 5.2], [0, -11.5, 20.5], face);
ell([3.6, 2.8, 2.6], [0, -15, 18.6], face);
mirror_x() ell([0.9, 0.5, 0.6], [1.1, -17.5, 19.2], nose);
color([0.4, 0.25, 0.25]) translate([0, -17.4, 17.6]) scale([1.4, 0.4, 0.3]) sphere(1, $fn = 12);
mirror_x() eye([3, -15.4, 21.6], 1.4, iris = [0.1, 0.08, 0.08], pupil = [0.1, 0.08, 0.08], yaw = -22, flat = 0.6);
// Fringe and crown of wool.
for (p = [[0, -13, 26.4, 3], [-3.8, -12.4, 25.6, 2.8], [3.8, -12.4, 25.6, 2.8], [-6, -11, 23.4, 2.4],
          [6, -11, 23.4, 2.4], [0, -9.5, 28, 3.2], [-3.2, -8, 27, 3], [3.2, -8, 27, 3], [-1.9, -14.6, 24.6, 1.8],
          [1.9, -14.6, 24.6, 1.8], [0, -6, 25, 4]])
  color(wool) translate([p[0], p[1], p[2]]) sphere(p[3], $fn = 16);
// Floppy ears sticking out sideways.
mirror_x() {
  petal([3.4, 1.5, 1.4], [7.6, -11.2, 21.8], [0, 15, 20], ear);
  petal([2.4, 0.8, 0.9], [7.8, -12.3, 21.6], [0, 15, 20], earIn);
}

// Little curled tail on the back.
chain([[0, 15, 16], [0, 17.5, 18.5], [0, 17, 21.5], [0, 15.6, 21]], [1.9, 1.8, 1.6, 1.3], wool);
