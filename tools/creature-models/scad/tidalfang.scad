// Tidalfang: a sleek aqua sea dragon standing tall: a pearly banded belly, a long curved neck, a big-eyed
// head with swept horns and frilled fin ears, a pale mint-lilac sail of webbed spines rising behind its shoulders,
// little clawed arms, and a long tail that loops up its side, sweeps across the front and ends in a finned curl.
include <lib.scad>

aqua = [0.22, 0.72, 0.74];
aquaHi = [0.42, 0.85, 0.85];
aquaDark = [0.1, 0.48, 0.52];
scaleC = [0.13, 0.58, 0.62];
pearl = [0.86, 0.89, 0.93];
pearlLine = [0.66, 0.7, 0.8];
sail = [0.7, 0.94, 0.9];
sailB = [0.8, 0.78, 0.98];
sailRib = [0.3, 0.72, 0.74];
claw = [0.9, 0.95, 0.95];
drop = [0.45, 0.68, 0.95];

// Catmull-Rom spline through control points P, n samples per span: smooth body paths.
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function spline(P, n) = concat([for (i = [0 : len(P) - 2]) for (k = [0 : n - 1])
  cr(P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)], k / n)], [P[len(P) - 1]]);
function lerp_r(R, n) = concat([for (i = [0 : len(R) - 2]) for (k = [0 : n - 1]) R[i] + (R[i + 1] - R[i]) * k / n], [R[len(R) - 1]]);

// Torso and neck: one smooth S from the hips up through a slim chest into a long neck curving forward.
spine = spline([[0, 1.5, 11], [0, 0.5, 16], [0, -0.5, 21], [0, -1.2, 25.5], [0, -2.4, 29.5], [0, -4, 32.5]], 3);
spineR = lerp_r([6, 6, 5, 3.7, 2.9, 2.6], 3);
chain(spine, spineR, aqua, $fn = 18);
// Pearl belly down the front, with darker bands.
chain([for (i = [0 : len(spine) - 2]) spine[i] + [0, -spineR[i] * 0.45, 0]], [for (i = [0 : len(spine) - 2]) spineR[i] * 0.7], pearl, $fn = 16);
for (i = [1 : len(spine) - 3]) color(pearlLine) translate(spine[i] + [0, -spineR[i] * 0.6, 0]) rotate([-12, 0, 0])
  scale([spineR[i] * 0.62, spineR[i] * 0.62, 0.22]) sphere(1, $fn = 14);

// Head: a rounded cranium hulled into a short, tapered muzzle, pearly under the jaw.
translate([0, -6, 34]) scale(1.18) translate([0, 6, -34]) {
color(aqua) hull() {
  translate([0, -5, 35]) scale([3.6, 3.6, 3.2]) sphere(1, $fn = 20);
  translate([0, -9, 34]) scale([2.4, 2.4, 2]) sphere(1, $fn = 16);
  translate([0, -11.4, 33.4]) scale([1.4, 1.2, 1.2]) sphere(1, $fn = 12);
}
color(pearl) hull() {
  translate([0, -6, 32.6]) scale([2.6, 2.6, 1.2]) sphere(1, $fn = 14);
  translate([0, -10.6, 32.8]) scale([1.2, 1, 0.7]) sphere(1, $fn = 10);
}
ell([1.2, 3.4, 0.8], [0, -8, 35.8], aquaHi);
mirror_x() {
  ell([0.32, 0.3, 0.3], [0.8, -12.4, 33.8], aquaDark);
  // Big round friendly eyes with a bright highlight, turned out along the cheek and sunk so only their face shows,
  // in a thin dark rim with a soft aqua brow above (no scowl: Tidalfang is gentle).
  translate([2.3, -7.6, 35.1]) rotate([0, 0, 30]) {
    color(aquaDark) translate([0, 0.5, 0]) scale([1.12, 0.5, 1.18]) sphere(2, $fn = 20);
    scale([1, 0.7, 1]) eye([0.01, 0, 0], 2, iris = [0.16, 0.24, 0.3], pupil = [0.03, 0.05, 0.07], flat = 0.6);
    color(aqua) hull() {
      translate([0.9, 0.4, 1.9]) scale([0.9, 0.7, 0.4]) sphere(1, $fn = 10);
      translate([-1.1, 0, 1.7]) scale([0.8, 0.7, 0.4]) sphere(1, $fn = 10);
    }
  }
  // Horns curving up and back from the crown.
  chain([[1.6, -4.4, 37.6], [2.4, -2.4, 40.6], [2.4, 0.4, 42.6], [1.8, 2.6, 43]], [1.05, 0.8, 0.5, 0.12], aquaHi, $fn = 10);
  // Frilled fin ears: ribs fanning out sideways with a pale web between.
  ear = [[3.4, 1.6, 2.8], [4.2, 2.6, 0.8], [4, 3.2, -1.2], [2.8, 3, -2.8]];
  for (k = [0 : len(ear) - 2]) color(sail) hull() {
    translate([3.2, -4.4, 34.6]) sphere(0.25, $fn = 6);
    translate([3.2, -4.4, 34.6] + ear[k]) sphere(0.25, $fn = 6);
    translate([3.2, -4.4, 34.6] + ear[k + 1]) sphere(0.25, $fn = 6);
  }
  for (e = ear) limb([3.2, -4.4, 34.6], [3.2, -4.4, 34.6] + e, 0.4, 0.12, aquaHi);
}
}

// Sail: two webbed fans rising behind the shoulders, splayed into a shallow V, each panel dipping between its rib tips
// so the edge is scalloped. rib = [base y, base z, tip x, tip y, tip z]
ribs = [[0.5, 28, 3, 1, 43], [1.4, 25, 6, 4, 45], [2.2, 22, 9.5, 7, 43], [2.8, 19, 12, 9, 38], [3.2, 16, 13, 10, 31], [3.4, 13, 11, 9, 23]];
function rb(r) = [1.4, r[0] + 1.6, r[1]];
function rt(r) = [r[2], r[3] + 1.6, r[4]];
mirror_x() {
  for (k = [0 : len(ribs) - 2]) let(a = ribs[k], b = ribs[k + 1], m = (rt(a) + rt(b)) / 2 * 0.86 + (rb(a) + rb(b)) / 2 * 0.14)
    color(k % 2 == 0 ? sail : sailB) {
      hull() { translate(rb(a)) sphere(0.25, $fn = 6); translate(rt(a)) sphere(0.25, $fn = 6); translate(m) sphere(0.25, $fn = 6); translate(rb(b)) sphere(0.25, $fn = 6); }
      hull() { translate(rb(b)) sphere(0.25, $fn = 6); translate(rt(b)) sphere(0.25, $fn = 6); translate(m) sphere(0.25, $fn = 6); }
    }
  for (r = ribs) limb(rb(r), rt(r), 0.6, 0.18, sailRib);
  // Fine veins down the middle of each web panel, and an aqua rim along the scalloped edge.
  for (k = [0 : len(ribs) - 2]) let(a = ribs[k], b = ribs[k + 1], m = (rt(a) + rt(b)) / 2 * 0.86 + (rb(a) + rb(b)) / 2 * 0.14) {
    limb((rb(a) + rb(b)) / 2, m, 0.22, 0.1, sailRib);
    limb(rt(a), m, 0.22, 0.22, aquaHi);
    limb(m, rt(b), 0.22, 0.22, aquaHi);
  }
}
// Crest of small spines between the sails and down the back.
for (r = ribs) spike([0, r[0] + 2.2, r[1]], [0, 1.2, 1.4], 0.6, 0.1, aquaHi);

// Little arms held up in front of the chest, clawed hands.
mirror_x() {
  chain([[4.4, -2.4, 22.5], [6, -3.6, 19], [4.4, -6.2, 18.6]], [1.4, 1.1, 0.9], aqua, $fn = 12);
  for (a = [-30, 0, 30]) spike([4.2 + sin(a) * 0.8, -6.8, 18.6], [sin(a) * 0.5, -1.1, 0.4], 0.35, 0.05, claw);
  // A pale fin flap trailing off each elbow, like the sprite's.
  color(sail) hull() {
    translate([6, -3.4, 19.4]) sphere(0.3, $fn = 6);
    translate([5.2, -5.4, 18.8]) sphere(0.3, $fn = 6);
    translate([8.6, -1.6, 17.4]) sphere(0.25, $fn = 6);
  }
  limb([6, -3.4, 19.4], [8.6, -1.6, 17.4], 0.3, 0.15, aquaHi);
}

// Legs: strong thighs, digitigrade shins, clawed feet.
mirror_x() {
  ell([3.8, 4.4, 4.6], [4.6, 1, 10.4], aqua);
  chain([[4.8, 0.4, 8.6], [5.6, 3, 5.4], [5.4, 0.8, 3.4]], [2.2, 1.5, 1.2], aqua, $fn = 12);
  ell([1.6, 2.6, 0.9], [5.4, -0.6, 3.2], aqua);
  for (a = [-30, 0, 30]) spike([5.4 + sin(a) * 1, -2.6, 3], [sin(a) * 0.8, -1.6, -0.4], 0.45, 0.05, claw);
}

// Tail: back from the hips, looping up the creature's left side (viewer's right), sweeping down and across the front
// low past its feet, and ending in a finned curl on the far side.
tail = spline([[0, 5, 10], [6, 7, 8], [11.5, 5, 11], [12.5, 0.5, 17], [9.5, -4, 18.5], [7.5, -6, 13], [7, -7, 7.5],
               [2, -9, 5], [-5, -9, 5], [-11, -6.5, 6], [-14, -5.5, 10], [-12, -5, 13], [-9.6, -5, 11], [-10.6, -5, 9]], 3);
tailR = [for (i = [0 : len(tail) - 1]) 3.6 - 3.1 * i / (len(tail) - 1)];
chain(tail, tailR, aqua, $fn = 14);
// Pearl underside along the tail's first loop.
chain([for (i = [3 : 20]) tail[i] + [-tailR[i] * 0.35, -tailR[i] * 0.2, -tailR[i] * 0.35]], [for (i = [3 : 20]) tailR[i] * 0.7], pearl, $fn = 12);
for (i = [4 : 3 : 28]) spike(tail[i] + [0, 0, tailR[i] * 0.8], [0, 0.4, 1.4], 0.5, 0.08, aquaHi);
// Scales: rows of small raised darker-teal scutes over the back of the tail and down the back, so neither reads as a
// plain tube from behind.
for (i = [1 : 2 : 30]) let(d = tail[i + 1] - tail[i - 1], u = d / norm(d), a = cross(u, [0, 0, 1]), side = a / max(norm(a), 0.01),
                          up = cross(side, u)) for (k = [-1, 0, 1]) if ((i + k) % 4 != 0)
  color(scaleC) translate(tail[i] + (up * cos(k * 45) + side * sin(k * 45)) * tailR[i] * 0.93) rotate(_dir_rot(up * cos(k * 45) + side * sin(k * 45)))
    scale([tailR[i] * 0.3, tailR[i] * 0.3, 0.3]) sphere(1, $fn = 8);
for (i = [1 : len(spine) - 3]) for (k = [-1, 1]) let(dir = [k * 0.75, 0.66, 0])
  color(scaleC) translate(spine[i] + dir * spineR[i] * 0.95) rotate(_dir_rot(dir)) scale([spineR[i] * 0.28, spineR[i] * 0.28, 0.3])
    sphere(1, $fn = 8);
// Tail-curl fin: a pale web inside the curl.
color(sail) hull() for (p = [[-11, -5, 6.4], [-14.6, -5.4, 9.6], [-12.4, -5.2, 13.4], [-10, -5, 11.6]]) translate(p) sphere(0.3, $fn = 6);

// Water droplets hanging nearby.
for (d = [[-10, -6, 30], [10, -6, 34], [-12, -3, 22], [14, -4, 24], [-9, -8, 16]])
  color(drop) translate(d) { sphere(0.8, $fn = 10); translate([0, 0, 0.4]) cylinder(h = 1.4, r1 = 0.75, r2 = 0, $fn = 10); }
