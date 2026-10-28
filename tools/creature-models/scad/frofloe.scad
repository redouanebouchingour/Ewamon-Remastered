// Frofloe: Slushpup grown into a lean ice wolf, a huge mane of ice shards around its snarling face, a plumed tail.
include <lib.scad>

fur = [0.72, 0.84, 0.95];
furHi = [0.88, 0.94, 1.0];
furDark = [0.45, 0.6, 0.8];
ice = [0.6, 0.8, 0.97];
iceHi = [0.85, 0.94, 1.0];
iceDark = [0.4, 0.6, 0.88];
dark = [0.12, 0.15, 0.22];
claw = [0.92, 0.96, 1.0];

// Lean body: deep chest, tucked waist, rump.
blob([[[5.4, 6, 5.6], [0, -6, 16]], [[4.6, 5, 4.6], [0, 4, 16.5]]], fur);
ell([3.8, 6, 2.6], [0, -2, 12.6], furHi);

// Legs: forelegs splayed wide in a crouch, hind legs straight, big clawed paws.
module paw(p) {
  blob([[[1.8, 2.3, 1.2], p], [[1.5, 1.2, 1.2], p + [0, 1.2, 0.4]]], fur);
  for (a = [-30, 0, 30]) spike(p + [sin(a) * 1.2, -2.1, 0], [sin(a) * 0.4, -1, -0.6], 0.35, 0.05, claw);
}
mirror_x() {
  limb([4, -8, 15], [7.5, -10, 8], 3.2, 2.4, fur);
  limb([7.5, -10, 8], [8.6, -11, 1.4], 2.4, 1.9, fur);
  spike([7.8, -9, 9], [1.4, 1.6, 2.4], 0.7, 0.05, ice);
  paw([8.6, -11.6, 1.1]);
  ell([3.4, 4.2, 4.6], [3.8, 4.5, 15], fur);
  limb([4.6, 6, 13], [5, 8.5, 7], 2.8, 2, fur);
  limb([5, 8.5, 7], [5, 6.5, 1.4], 2, 1.7, fur);
  spike([5, 8.4, 7.6], [0.6, 2.4, 1.2], 0.6, 0.05, ice);
  paw([5, 5.8, 1.1]);
}

// Head, low and forward, with a long pointed snout.
blob([[[4.4, 4.2, 4], [0, -13, 18]], [[2, 3.6, 1.8], [0, -18, 16.6]]], fur);
ell([2.6, 3.2, 1.6], [0, -16, 15.6], furHi);
ell([0.9, 0.7, 0.7], [0, -21.4, 17.2], dark);
// Snarl: dark mouth line with fangs.
color(dark) translate([0, -18.6, 15.6]) rotate([90, 0, 0]) scale([2, 0.5, 0.4]) cylinder(h = 2, r = 1, center = true, $fn = 14);
mirror_x() spike([1.1, -19.4, 15.8], [0, 0, -1.2], 0.35, 0.05, claw);
// Narrow fierce eyes with dark brows angled down.
mirror_x() {
  eye([2.4, -16, 19.2], 1.15, iris = [0.35, 0.65, 0.95], pupil = dark, sclera = furHi, yaw = 30, flat = 0.55);
  color(furDark) translate([2.3, -16.6, 20.4]) rotate([0, 24, 30]) scale([1.8, 0.7, 0.45]) sphere(1, $fn = 12);
}
// Pointed ears.
mirror_x() {
  spike([2.8, -11.6, 21], [1.4, 0.8, 4.4], 1.5, 0.1, fur);
  spike([2.8, -12.2, 21.2], [1.2, 0.4, 3.4], 0.8, 0.1, furDark);
}

// A faceted crystal shard from p along d.
module shard(p, d, r, c) {
  color(c) hull() {
    translate(p) scale([1, 1, 0.6]) sphere(r, $fn = 6);
    translate(p + d * 0.55) sphere(r * 0.75, $fn = 6);
    translate(p + d) sphere(0.08, $fn = 4);
  }
}

// Ice-shard mane: rings of shards bursting out around the head and over the shoulders.
for (ring = [[-10.5, 6.8, 5, 14, 0], [-8, 7.4, 6, 14, 12], [-5.5, 6.2, 5, 11, 6]]) {
  y = ring[0]; rr = ring[1]; len0 = ring[2]; n = ring[3];
  for (i = [0 : n - 1]) let(a = i * 360 / n + ring[4], d = [cos(a), 0.35, sin(a)], c = (i % 3 == 0) ? iceHi : (i % 3 == 1) ? ice : iceDark)
    if (sin(a) > -0.75)
      shard([cos(a) * rr * 0.5, y, 17.5 + sin(a) * rr * 0.5], d * (len0 + (i % 2) * 1.8) + [0, 0, 1], 1.5, c);
}
// Chest shards under the jaw.
for (i = [0 : 4]) let(x = -2 + i) shard([x, -11, 13.5], [x * 0.3, -1.4, -3.6 + abs(x) * 0.5], 1.1, i % 2 == 0 ? ice : iceHi);
// Shards down the back.
for (i = [0 : 3]) shard([0, -2 + i * 3, 20.5], [0, 1.6, 4 - i * 0.7], 1.4, ice);

// Plumed tail sweeping back and up into a curl, a bushy brush of fur flames along its outer edge.
tail = [[0, 8.5, 18], [0, 13, 20], [0, 17, 24], [0, 18, 29], [0, 15, 32.5], [0, 11.5, 32]];
trs = [2, 3.2, 4.2, 4.4, 3.6, 2];
for (i = [0 : len(tail) - 2]) color(i % 2 == 0 ? fur : furHi) hull() {
  translate(tail[i]) scale([0.9, 1, 1]) sphere(trs[i], $fn = 16);
  translate(tail[i + 1]) scale([0.9, 1, 1]) sphere(trs[i + 1], $fn = 16);
}
// Outward normals of the curl (away from its centre near [0, 13, 27]).
for (i = [1 : len(tail) - 1]) let(t = tail[i], n = (t - [0, 12.5, 26.5]) / norm(t - [0, 12.5, 26.5]))
  for (k = [-1, 1]) shard(t + n * trs[i] * 0.4 + [k * 0.8, 0, 0], n * (4 + trs[i]) + [k * 1.2, 0, 0.6], 1.5, (i + k) % 3 == 0 ? furDark : (i % 2 == 0 ? ice : furHi));
shard([0, 11.5, 32], [0, -3.5, -0.5], 1.3, furHi);
