// Voidraxis: a coiled eastern void dragon, starry indigo body laced with glowing violet scale lines, a streaming
// teal-violet mane, long whiskers, a glowing eye and small clawed forelegs.
include <lib.scad>

body = [0.11, 0.07, 0.27];
bodyHi = [0.22, 0.14, 0.45];
line = [0.72, 0.45, 1];
star = [0.85, 0.85, 1];
maneA = [0.2, 0.42, 0.55];
maneB = [0.32, 0.2, 0.6];
maneC = [0.12, 0.12, 0.35];
glow = [0.9, 0.75, 1];
claw = [0.75, 0.68, 0.9];
mouth = [0.45, 0.12, 0.3];

// Coiled lower body: tail tip on the outside, spiralling inward and upward.
N = 22;
coil = [for (i = [0 : N]) let(a = -60 + i * 24, r = 10 - i * 0.2, z = 2.6 + i * 0.25 + 2.2 * sin(i * 16)) [r * cos(a), r * sin(a), z]];
coilR = [for (i = [0 : N]) 0.5 + 2.7 * min(1, i / 14)];
neck = [[2, 3, 12], [2.5, 0.5, 16], [1.5, -1.5, 20], [-1, -0.5, 24], [-2, -2, 27]];
neckR = [3.1, 3.1, 3, 2.8, 2.5];
pts = concat(coil, neck);
rs = concat(coilR, neckR);
chain(pts, rs, body);
// Glowing violet rings and a dorsal line along the whole length.
for (i = [2 : len(pts) - 2]) let(d = pts[i + 1] - pts[i - 1])
  color(line) translate(pts[i]) rotate(_dir_rot(d)) rotate_extrude($fn = 18) translate([rs[i] * 0.97, 0]) circle(0.22, $fn = 4);
chain([for (i = [0 : len(pts) - 1]) pts[i] + [0, 0, rs[i] * 0.93]], [for (r = rs) 0.22], line);
// Stars sprinkled over the body.
for (i = [3 : len(pts) - 2]) for (k = [0 : 2]) let(a = i * 97 + k * 131, p = pts[i])
  color(star) translate(p + rs[i] * 0.97 * [cos(a), sin(a) * 0.9, sin(a * 1.7) * 0.6]) sphere(0.22, $fn = 6);
// Belly plates on the neck (front).
for (i = [1 : 3]) ell([1.8, 0.8, 1.4], neck[i] + [0, -neckR[i] * 0.85, 0], bodyHi);

// Tail tip fin.
spike(coil[0], [2.4, -2.5, -0.4], 0.5, 0.05, body);

// Small clawed forelegs at the neck base.
mirror_x() {
  limb([2.2, -1.5, 17], [4.6, -4, 15], 1.1, 0.9, body);
  limb([4.6, -4, 15], [5.4, -6, 16.5], 0.9, 0.7, body);
  for (a = [-40, 0, 40]) spike([5.4, -6.4, 16.8], [sin(a) * 1.2, -1.4, cos(a) * 0.6 + 0.4], 0.28, 0.05, claw);
}

// Head: long snout facing -Y, open jaw with fangs.
hp = [-2, -3, 29];
translate(hp) scale(1.35) {
  blob([[[3, 3.2, 2.6], [0, 0, 0.4]], [[2, 3, 1.5], [0, -4.2, 0.6]]], body);
  ell([1.6, 1, 1.1], [0, -6.6, 0.8], bodyHi);
  // lower jaw, open
  translate([0, 0, -1.2]) rotate([-18, 0, 0]) blob([[[2.2, 2, 0.9], [0, -0.6, -0.4]], [[1.4, 2.4, 0.7], [0, -4.2, -0.6]]], body);
  ell([1.6, 3, 0.6], [0, -3.2, -1.4], mouth);
  mirror_x() {
    spike([1.1, -5.6, -0.2], [0, 0, -1.4], 0.32, 0.05, claw);
    spike([0.9, -4.5, -2.8], [0, 0, 1.2], 0.28, 0.05, claw);
    // glowing eye with a brow ridge
    ell([0.9, 0.7, 0.55], [2.1, -2.3, 1.7], glow);
    ell([0.4, 0.3, 0.3], [2.25, -2.75, 1.75], [1, 1, 1]);
    color(bodyHi) translate([2.1, -2.3, 2.5]) rotate([0, -15, -25]) scale([1.6, 0.8, 0.4]) sphere(1, $fn = 12);
    // nostrils and long whiskers
    ell([0.3, 0.3, 0.25], [0.7, -7.5, 1.2], [0.05, 0.03, 0.1]);
    chain([[1.4, -6.5, 1], [4, -7.5, 0.5], [7.5, -6, -1], [10, -3, -1.5]], [0.25, 0.2, 0.15, 0.08], maneB);
  }
  // Horns sweeping back.
  mirror_x() chain([[1.4, 0.6, 2.4], [2.6, 3, 4.2], [3.4, 6, 5]], [0.6, 0.45, 0.15], claw);
  // Mane: streaming locks behind the head, down the neck.
  for (k = [0 : 10]) let(a = -90 + k * 18, c = k % 3 == 0 ? maneA : (k % 3 == 1 ? maneB : maneC))
    chain([[sin(a) * 2.2, 0.5, 2 + cos(a) * 0.6], [sin(a) * 4.2, 3.5, 3.6 + cos(a * 2) * 0.8], [sin(a) * 6, 6.5, 2.5 + cos(a) * 1.5], [sin(a) * 7.5, 9.5, -0.5 + (k % 2) * 1.5]],
          [1.5, 1.3, 0.8, 0.2], c);
  for (k = [0 : 4]) let(z = -1 - k * 2.2)
    chain([[0, 2, z], [k % 2 == 0 ? 2.4 : -2.4, 5, z - 0.5], [k % 2 == 0 ? 4 : -4, 8, z - 2]], [1.5, 1.0, 0.2], k % 2 == 0 ? maneA : maneB);
}
// Mane tufts along the neck back.
for (i = [1 : 3]) chain([neck[i] + [0, 2, 0], neck[i] + [i % 2 == 0 ? 2 : -2, 6, -1], neck[i] + [i % 2 == 0 ? 3 : -3, 8, -3]],
                         [1.5, 1.0, 0.2], i % 2 == 0 ? maneA : maneB);
