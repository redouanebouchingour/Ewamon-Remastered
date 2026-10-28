// Raidori Tenjin: the thunder beast turned pale porcelain, cracked with gold, a flowing golden mane and a halo.
include <lib.scad>

body = [0.8, 0.8, 0.82];
bodyDk = [0.62, 0.62, 0.66];
patch = [0.98, 0.92, 0.75];
stripe = [0.9, 0.7, 0.2];
mane = [0.98, 0.84, 0.35];
maneDk = [0.88, 0.66, 0.15];
mask = [0.88, 0.88, 0.9];
paw = [0.98, 0.88, 0.5];
star = [1, 0.88, 0.45];
halo = [0.95, 0.75, 0.3];
fang = [1, 1, 1];

// Torso, long along Y, chest higher than hips.
blob([[[7, 8, 6.5], [0, -5, 17]], [[6.5, 7, 6], [0, 6, 16]]], body);
// Pale chest and flank patches.
ell([4.2, 1.6, 4], [0, -11.6, 15.5], patch);
mirror_x() ell([1.2, 3.2, 2.6], [6.4, 4, 15], patch);
// Lightning-scar stripes on the flanks.
// Gold kintsugi cracks over flanks and back.
mirror_x() for (s = [[-6, 18, 25], [-2, 16, -35], [1, 19, 15], [4, 15, -20], [7, 18, 40], [9, 14, 10]])
  color(stripe) translate([6.9, s[0], s[1]]) rotate([s[2], 0, 0]) scale([0.4, 0.35, 3.2]) sphere(1, $fn = 10);
for (s = [[-4, 60], [0, -50], [5, 70]])
  color(stripe) translate([0, s[0], 23.2]) rotate([0, 0, s[1]]) scale([4, 0.35, 0.4]) sphere(1, $fn = 10);

// Legs: thick, with white paws and claws.
module leg(x, y, front) {
  limb([x, y, 14], [x * 1.05, y + (front ? -1 : 1), 6], front ? 3.2 : 3.6, 2.4, body);
  limb([x * 1.05, y + (front ? -1 : 1), 6], [x * 1.05, y + (front ? -1.5 : 0.5), 1.6], 2.4, 2.2, body);
  ell([2.6, 3.2, 1.6], [x * 1.05, y + (front ? -2.5 : -0.5), 1.4], paw);
  for (a = [-1, 0, 1]) spike([x * 1.05 + a * 1.2, y + (front ? -5.3 : -3.3), 1], [0, -0.8, -0.4], 0.35, 0.05, bodyDk);
}
mirror_x() { leg(4.6, -8, true); leg(4.6, 8, false); }

// Back spikes, dark grey, over the hips.
for (s = [[0, 4, 0], [0, 7, 20], [-2, 5, -20], [2, 5, 20], [0, 9.5, 35]])
  spike([s[0], s[1], 21], [s[0] * 0.8, 1 + s[2] / 15, 6], 1.6, 0.1, mane);

// Tail: rises from the rump, arcs out to the viewer's right and hangs down to a yellow star.
chain([[0, 13, 18], [1, 16, 24], [4, 18, 28.5], [8, 19, 30], [12, 18.5, 28], [13.5, 18, 24], [13.5, 18, 21]],
      [1.5, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8], bodyDk);
module star4(p, r, rot) {
  color(star) translate(p) rotate(rot) for (a = [0 : 90 : 270]) rotate([0, a, 0]) hull() {
    scale([1, 0.8, 1]) sphere(r * 0.35, $fn = 12);
    translate([r, 0, 0]) sphere(r * 0.08, $fn = 8);
  }
}
star4([13.5, 18, 17.5], 4.2, [0, 0, -30]);
star4([13.5, 18, 17.5], 2.4, [0, 45, -30]);

// Neck and head.
blob([[[5, 5, 5], [0, -9, 22]], [[4.6, 4.6, 4.4], [0, -13, 26]]], body);
// Head with a lilac mask over the brow.
ell([4.6, 5, 4.2], [0, -15, 28], body);
ell([4.2, 3.6, 2.6], [0, -16.5, 30.2], mask);
// Muzzle, yellow like the mane, with long white fangs.
blob([[[3.4, 3, 2.4], [0, -19.5, 26]], [[2.6, 2, 1.8], [0, -21.5, 25.5]]], mane);
color(bodyDk) translate([0, -23.3, 26.4]) scale([0.9, 0.6, 0.6]) sphere(1, $fn = 12);
mirror_x() spike([1.5, -21.5, 24.6], [0, -0.3, -4], 0.75, 0.1, fang);
// Fierce red eyes.
mirror_x() {
  eye([2.6, -19.2, 28.6], 1.2, iris = [0.95, 0.75, 0.2], pupil = [0.5, 0.35, 0.05], yaw = -20);
  color(bodyDk) translate([2.6, -19.8, 29.9]) rotate([0, -20, -20]) scale([1.6, 0.6, 0.45]) sphere(1, $fn = 12);
}
// Pointed ears.
mirror_x() spike([2.8, -13.5, 31.5], [1.4, 1, 4], 1.4, 0.1, body);
// Small horn crest on the brow.
spike([0, -17, 32.3], [0, -0.4, 3], 0.8, 0.1, stripe);

// Flowing golden mane: thick curling locks sweeping back from the head.
module lock(a, l, c) {
  p0 = [cos(a) * 4, -12, 26 + sin(a) * 4.5];
  d = [cos(a), 0, sin(a)];
  q = [-sin(a), 0, cos(a)];
  chain([p0, p0 + d * l * 0.5 + [0, 2, 0], p0 + d * l + q * 2 + [0, 3.5, 0], p0 + d * l * 0.85 + q * 4 + [0, 4.5, 0]],
        [2.2, 1.8, 1.1, 0.5], c);
}
for (i = [0 : 11]) lock(i * 30 + 15, 8 + (i % 2) * 2.5, i % 3 == 0 ? maneDk : mane);
ell([7, 4.5, 7], [0, -10.5, 26], mane);
mirror_x() chain([[3.5, -18, 25.5], [6, -17, 22], [6.5, -15, 19], [5, -13.5, 17.5]], [1.6, 1.3, 0.9, 0.5], mane);
for (i = [0 : 3]) chain([[0, -8 + i * 2.5, 27 - i], [0, -6 + i * 2.5, 30 - i], [0, -3.5 + i * 2.5, 30.5 - i]], [2, 1.2, 0.5], maneDk);

// Halo: a thin golden ring standing behind the head, with a small diamond at its crown.
color(halo) translate([0, -6, 32]) rotate([90, 0, 0]) rotate_extrude($fn = 48) translate([10, 0]) circle(0.45, $fn = 8);
color(halo) translate([0, -6, 42]) scale([0.9, 0.4, 1.4]) sphere(1, $fn = 4);
color(halo) translate([0, -6, 40.3]) rotate([90, 0, 0]) rotate_extrude($fn = 16) translate([1.3, 0]) circle(0.25, $fn = 6);
// Sparkles floating around.
for (p = [[-11, -14, 32], [12, -12, 18], [-12, -4, 14], [11, -16, 36], [-9, 8, 30]]) star4(p, 1.3, [0, 0, 0]);
