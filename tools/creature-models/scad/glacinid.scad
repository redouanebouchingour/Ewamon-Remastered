// Glacinid: a pale-blue ice serpent in an S-coil: its neck rears up at the front, its tail rises at the back, and
// branching frost antlers and fronds grow from its head, spine and tail; a violet crystal crowns its head.
include <lib.scad>

ice = [0.72, 0.82, 0.95];
iceHi = [0.88, 0.94, 1];
iceDk = [0.52, 0.64, 0.85];
belly = [0.66, 0.66, 0.88];
frost = [0.62, 0.78, 0.94];
violet = [0.38, 0.22, 0.6];
violetHi = [0.6, 0.45, 0.85];

function nrm(v) = v / norm(v);
function perp(d) = let(c = cross(d, [0, 0, 1])) norm(c) < 0.001 * norm(d) ? [1, 0, 0] : nrm(c);

// Branching frost: a twig from p along d that forks into two smaller twigs, `depth` times.
module branch(p, d, r, depth, spin = 0) {
  limb(p, p + d, r, r * 0.65, frost);
  if (depth > 0) {
    u = perp(d);
    w = nrm(cross(nrm(d), u));
    for (s = [-1, 1]) {
      side = u * cos(spin) * s + w * sin(spin) * s;
      nd = (nrm(d) * cos(44) + side * sin(44)) * norm(d) * 0.68;
      branch(p + d, nd, r * 0.6, depth - 1, spin + 50);
    }
    // A short spur straight on.
    limb(p + d, p + d * 1.45, r * 0.55, 0.12, frost);
  }
}

// Serpent body: from the base of the neck (front, viewer's left) down into a ground coil that runs out to the viewer's
// right and behind, then back up into the tail.
pts = [[-7, -6, 24], [-7, -6.5, 16], [-6, -4, 8], [-1, 0, 4.6], [6, 2, 4.4], [13, 4, 4.8], [19, 6, 8], [21.5, 7, 15],
       [21, 7, 22], [19, 6.5, 28]];
rs = [4.6, 5.2, 5.6, 5, 4.6, 4.2, 3.6, 3, 2.2, 1.1];
chain(pts, rs, ice);
// Lavender underbelly along the front of the neck and the bottom of the coil.
chain([[-7, -9.8, 20], [-7, -10.4, 14], [-5.6, -7.6, 7], [-2, -3.6, 3], [6, -1.4, 2.2], [13, 0.6, 2.4]], [2.8, 3.4, 3.6, 3.2, 2.8, 2.4], belly);
// Ice-plate ridges: pale chevrons down the neck.
for (i = [0 : 3]) color(iceHi) translate([-7, -10 - (i < 2 ? 0.8 : 0.3), 22 - i * 4]) rotate([10, 0, 0]) scale([3.2, 1, 1]) sphere(1, $fn = 12);

translate([-7, -6, 24]) scale(1.35) translate([0, 8, -27]) {
// Head: a dragon head on top of the neck, snout forward.
blob([[[5.2, 5, 4.6], [0, -8.8, 29]], [[3, 3.2, 2.6], [0, -14, 27.8]]], ice);
ell([2.6, 2.4, 1.6], [0, -13.8, 26.4], belly);
mirror_x() ell([0.35, 0.3, 0.3], [1.1, -17, 28.4], iceDk);
// Narrow, icy eyes.
mirror_x() {
  eye([3, -12.4, 30], 1.3, iris = [0.3, 0.45, 0.75], pupil = [0.12, 0.18, 0.35], yaw = -30, flat = 0.4);
  color(iceHi) translate([3.1, -12.6, 31.4]) rotate([0, 18, -30]) scale([1.8, 0.7, 0.5]) sphere(1, $fn = 10);
}
// Cheek spikes fanning back from the jaw.
mirror_x() for (k = [0 : 2]) spike([4.4, -8 + k * 1.2, 27.5 - k * 1.4], [3.2, 1.6, -0.4 + k * 0.6], 0.8, 0.05, iceHi);

// Violet crystal crown on the head.
for (c = [[0, 0, 7, 1.8], [-1.6, 0.6, 5, 1.4], [1.6, 0.6, 5, 1.4], [0, 1.8, 5.4, 1.4], [-0.8, -1.4, 4.4, 1.2], [0.9, -1.2, 4.2, 1.2]]) {
  spike([c[0], -8.2 + c[1], 32.6], [c[0] * 0.5, c[1] * 0.4, c[2]], c[3], 0.15, violet);
}
color(violetHi) translate([-0.4, -9.4, 35.4]) scale([0.3, 0.2, 1.4]) sphere(1, $fn = 8);

// Frost antlers branching out of the head.
mirror_x() branch([3.4, -7, 32], [3.4, 1.4, 5.6], 0.9, 2, 20);
}

// Frosty mane: a ruff of ice spikes round the top of the neck, flaring back.
for (a = [-150 : 30 : 150]) let(dx = sin(a), dy = -cos(a))
  spike([-7 + dx * 4, -6 + dy * 3.6, 23], [dx * 4, dy * 1.6 + 2.6, 1.6], 1.3, 0.08, iceHi);

// Frost fronds along the spine of the coil and up the tail, dense like coral.
branch([-4, 0.6, 9], [-1.6, 2, 7], 1, 2, 0);
branch([1.5, 2, 8], [-0.8, 2.4, 7.4], 1, 2, 30);
branch([6.5, 3, 8], [0.4, 2.2, 8], 1, 3, 60);
branch([11, 4.4, 8.2], [0.8, 2, 7.4], 0.95, 2, 90);
branch([15.5, 5.6, 9], [-0.6, 2.4, 7], 0.95, 3, 20);
branch([20.5, 9, 12], [3.6, 2, 5], 0.9, 2, 10);
branch([23, 7.6, 18], [4, 1, 4.4], 0.8, 2, 70);
branch([19, 8, 22], [-3.6, 1.6, 5.4], 0.8, 2, 40);
branch([19, 6.5, 28], [0.4, 0.4, 6], 0.8, 3, 20);
branch([8, 0, 2.4], [1, -5, 0.8], 0.6, 1, 90);
branch([-3, -2, 2.6], [-2, -5, 0.6], 0.6, 1, 90);
branch([16, 2.4, 3], [3, -4, 0.8], 0.6, 1, 90);
// Ice shards jutting along the coil.
for (s = [[-1, 1, 7.6], [4, 2.6, 7.6], [9, 3.8, 7.8], [13.4, 5, 8], [18, 6.4, 10.4]]) spike(s, [0.2, 1.2, 4.2], 1.5, 0.1, iceHi);

// Small ice claws under the coil.
for (p = [[-9.6, -5, 1], [-3.6, -4, 1], [11, 0.4, 1], [17, 6, 1.4]]) {
  ell([1.4, 1.6, 1.4], p + [0, 0, 0.6], ice);
  for (a = [-25, 25]) spike(p + [sin(a), -1.4, 0], [sin(a) * 0.6, -1.2, -0.4], 0.4, 0.05, iceHi);
}
