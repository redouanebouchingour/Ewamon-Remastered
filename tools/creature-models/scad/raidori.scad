// Raidori: a slate-grey thunder beast with a spiky yellow lightning mane, sabre fangs and a star-tipped tail.
include <lib.scad>

body = [0.33, 0.34, 0.45];
bodyDk = [0.22, 0.22, 0.3];
patch = [0.8, 0.8, 0.84];
stripe = [0.45, 0.46, 0.55];
streak = [0.56, 0.57, 0.68];
mane = [0.98, 0.8, 0.12];
maneDk = [0.85, 0.6, 0.05];
mask = [0.62, 0.62, 0.85];
paw = [0.95, 0.95, 0.97];
star = [1, 0.86, 0.3];
fang = [1, 1, 1];
socket = [0.1, 0.08, 0.16];

// Hard brow ridge over an eye at p (radius s, turned yaw like the eye): a hulled wedge in the skin colour, high at the
// temple and slanting down towards the nose, overhanging the eye so the face itself scowls.
module brow(p, s, yaw, drop, c) {
  translate(p) rotate([0, 0, yaw]) color(c) hull() {
    translate([s * 1.0, s * 0.05, s * 1.25]) scale([s * 0.6, s * 0.7, s * 0.36]) sphere(1, $fn = 12);
    translate([-s * 0.95, -s * 0.25, s * (1.25 - drop)]) scale([s * 0.5, s * 0.62, s * 0.32]) sphere(1, $fn = 12);
    translate([0, s * 0.9, s * 1.1]) scale([s * 1.1, s * 0.6, s * 0.5]) sphere(1, $fn = 12);
  }
}
// Flat scales / plates laid on an ellipsoid (centre cen, radii r): each [azimuth, elevation, size].
module plates(cen, r, list, th = 0.35, c) {
  for (t = list) let(az = t[0], el = t[1], sz = t[2])
    color(c) translate([cen[0] + r[0] * cos(el) * cos(az), cen[1] + r[1] * cos(el) * sin(az), cen[2] + r[2] * sin(el)])
      rotate([0, 0, az]) rotate([0, 90 - el, 0]) scale([sz, sz * 1.15, th]) sphere(1, $fn = 8);
}

// Torso, long along Y, chest higher than hips.
blob([[[7, 8, 6.5], [0, -5, 17]], [[6.5, 7, 6], [0, 6, 16]]], body);
// Pale chest and flank patches.
ell([4.2, 1.6, 4], [0, -11.6, 15.5], patch);
mirror_x() ell([1.2, 3.2, 2.6], [6.4, 4, 15], patch);
// Lightning-scar stripes on the flanks.
mirror_x() for (s = [[-4, 19, 20], [1, 18, -25], [6, 20, 30]])
  color(stripe) translate([6.6, s[0], s[1]]) rotate([s[2], 0, 0]) scale([0.4, 0.5, 3]) sphere(1, $fn = 10);

// Paler storm streaks raked back over the shoulders, back and haunches (the sprite's grey mottling).
mirror_x() for (k = [[-8, 4.6, 21.5, 30], [-3, 5.6, 21.5, 15], [2.5, 5.6, 21, 25], [7.5, 5, 20.6, 10], [10.5, 4.4, 18.6, 35], [-1, 2.6, 22.6, 20]])
  color(streak) translate([k[1], k[0], k[2]]) rotate([0, -40, 0]) rotate([k[3], 0, 0]) scale([0.55, 2.8, 0.9]) sphere(1, $fn = 10);

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
  spike([s[0], s[1], 21], [s[0] * 0.8, 1 + s[2] / 15, 6], 1.6, 0.1, bodyDk);

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
  color(socket) translate([2.45, -18.5, 29]) rotate([0, 0, 20]) scale([1.5, 0.6, 1.25]) sphere(1.2, $fn = 14);
  eye([2.4, -18.45, 29], 1.55, iris = [1, 0.1, 0.06, GLOW], pupil = [0.15, 0, 0], sclera = [1, 0.85, 0.3], yaw = 20, flat = 0.5,
      lid = 0.5, lid_tilt = 32, lid_c = socket);
  brow([2.4, -18.45, 29], 1.55, 20, 0.8, mask);
}
// Pointed ears.
mirror_x() spike([2.8, -13.5, 31.5], [1.4, 1, 4], 1.4, 0.1, body);
// Small horn crest on the brow.
spike([0, -17, 32.3], [0, -0.4, 3], 0.8, 0.1, mask);

// Lightning mane: jagged yellow spikes radiating from around the head and neck.
spikes = [for (i = [0 : 15]) let(a = i * 360 / 16) [a]];
for (s = spikes) {
  a = s[0];
  d = [cos(a), 0.15, sin(a)];
  l = 7 + 3 * ((floor(a / 22.5) % 3) == 0 ? 1 : (floor(a / 22.5) % 3 == 1 ? 0.3 : 0.6));
  spike([cos(a) * 4, -11.5, 26 + sin(a) * 4.5], [d[0] * l, 2 + abs(sin(a)) * 1.5, d[2] * l], 2, 0.1,
        (floor(a / 22.5) % 2 == 0) ? mane : maneDk);
}
// Inner mane collar and cheek tufts behind the head.
ell([7, 4, 7], [0, -10.5, 25.5], mane);
mirror_x() for (z = [22, 26]) spike([4, -16, z], [4.5, 0, z - 25], 1.6, 0.1, mane);
// Mane trailing down the neck behind.
for (i = [0 : 3]) spike([0, -8 + i * 2.5, 26 - i], [0, 3, 4 - i * 0.6], 2, 0.1, maneDk);
