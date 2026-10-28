// Meteorb: a cratered charcoal meteor rock split by glowing aqua seams, two glowing aqua eyes, ember-orange heat on
// its upper edges and a ring of small rocks orbiting it.
include <lib.scad>

rock = [0.42, 0.42, 0.46];
rockDark = [0.27, 0.27, 0.31];
seam = [0.38, 0.92, 0.75];
ember = [0.93, 0.45, 0.25];
eyeGlow = [0.45, 1, 0.8];
eyeSocket = [0.12, 0.12, 0.15];

C = [0, 0, 20];  // centre of the ball
R = 15;

// Glowing core that shows through the seams.
color(seam) translate(C) sphere(R - 0.8, $fn = 32);

// Rock plates: the ball cut into Voronoi cells around fibonacci directions; the gaps are the glowing seams. Cells
// on the upper-left carry an ember rim (an orange cell under a slightly smaller rock cell).
N = 18;
function fib(i) = let(y = 1 - 2 * (i + 0.5) / N, r = sqrt(1 - y * y), t = i * 137.508) [r * cos(t), r * sin(t), y];
module cell(i, r, gap, c) {
  d = fib(i);
  color(c) translate(C) intersection() {
    scale([1, 1, 1]) sphere(r, $fn = 36);
    intersection_for (j = [for (k = [0 : N - 1]) if (k != i && norm(fib(k) - d) < 1.4) k]) let(n = (d - fib(j)) / norm(d - fib(j)))
      translate(n * gap) rotate(_dir_rot(n)) translate([-60, -60, 0]) cube(120);
  }
}
for (i = [0 : N - 1]) {
  d = fib(i);
  hot = d[2] > 0.45 || d[0] < -0.7;
  if (hot) { cell(i, R, 0.9, ember); cell(i, R + 0.4, 1.6, rock); }
  else cell(i, R + (i % 2) * 0.5, 0.9, rock);
  // A crater on most plates.
  if (i % 3 != 1) color(rockDark) translate(C + d * (R + 0.1)) rotate(_dir_rot(d)) translate([1.4, 0.8, 0]) scale([2.2, 2.2, 0.6]) sphere(1, $fn = 14);
}

// Face: two tall glowing eyes in dark sockets on the front.
mirror_x() {
  color(eyeSocket) translate(C + [4, -R + 0.2, 0.5]) rotate([0, 0, 15]) scale([3, 1.6, 4]) sphere(1, $fn = 18);
  color(eyeGlow) translate(C + [4, -R - 0.4, 0.5]) rotate([0, 0, 15]) scale([2.1, 1.4, 3.1]) sphere(1, $fn = 18);
  color("white") translate(C + [3.5, -R - 1.6, 1.6]) sphere(0.6, $fn = 10);
}

// Orbiting pebbles, charcoal with an ember face.
pebbles = [[-20, -2, 32, 2], [19, 0, 30, 1.6], [-22, 2, 20, 1.2], [21, -1, 15, 1.8], [-18, -1, 7, 2], [7, -3, 1.6, 1.5], [-8, 4, 2, 1.3]];
for (p = pebbles) {
  color(rock) translate([p[0], p[1], p[2]]) scale([1.2, 1, 0.9]) sphere(p[3], $fn = 12);
  color(ember) translate([p[0], p[1], p[2]] + [-0.3, -0.3, 0.4] * p[3]) scale([1.0, 0.8, 0.6]) sphere(p[3], $fn = 10);
}
