// Abysspark Tenjin: the ascended Abysspark. Deep navy armour veined with gold, gilded spines, long pale jade fins
// streaming like wings, a pearl-white grin, a golden halo with a gem, and a sun-rayed golden lure.
include <lib.scad>

navy = [0.1, 0.18, 0.45];
navyDk = [0.06, 0.1, 0.3];
navyHi = [0.2, 0.32, 0.62];
cyan = [0.25, 0.8, 0.9];
yellow = [0.98, 0.78, 0.3];
gold = [0.9, 0.7, 0.28];
jade = [0.7, 0.9, 0.78];
jadeHi = [0.86, 0.97, 0.88];
haloGem = [0.55, 0.62, 0.45];
yellowHi = [1, 0.97, 0.65];
maw = [0.06, 0.12, 0.3];
tooth = [0.95, 0.95, 0.92];
dark = [0.04, 0.05, 0.12];

// Body: a heavy wedge, head forward (-Y), tapering to the tail.
blob([[[8, 9, 9], [0, -5, 18]], [[7, 7, 7.5], [0, 4, 16]], [[3.2, 4, 3.5], [0, 13, 13]]], navy);
// Heavy brow ridge.
blob([[[6.5, 4, 2.2], [0, -8.5, 24.5]], [[3.5, 2.5, 1.6], [0, -11.5, 23.6]]], navyDk);
// Lower jaw.
blob([[[6.8, 4, 3], [0, -10, 11.5]], [[5, 3, 2.2], [0, -14.5, 12]]], navy);
// Grinning maw lined with pearl teeth.
color(maw) translate([0, -13.5, 15.5]) scale([5.2, 3, 3]) sphere(1, $fn = 20);
for (i = [0 : 5]) {
  x = -4 + i * 1.6;
  ell([0.75, 0.75, 0.75], [x, -15.6 + abs(x) * 0.25, 17.6], tooth);
  ell([0.7, 0.7, 0.7], [x, -15.6 + abs(x) * 0.25, 13.4], tooth);
}
// Pale cheek plates.
mirror_x() ell([1, 3, 1.4], [5.2, -11.8, 13], [0.85, 0.88, 0.92]);
// Narrow glaring eyes.
mirror_x() {
  eye([5, -11.5, 21.2], 1.5, iris = [0.9, 1, 1], pupil = [0.9, 1, 1], sclera = [0.75, 0.95, 1], yaw = -35, flat = 0.35);
  color(navyDk) translate([4.8, -12, 22.8]) rotate([0, -25, -35]) scale([2.6, 0.8, 0.6]) sphere(1, $fn = 12);
}

// Lightning streaks and cyan flecks on the flanks.
module streak(p, rot, l, c) { color(c) translate(p) rotate(rot) scale([0.7, l, 0.7]) sphere(1, $fn = 8); }
mirror_x() {
  for (s = [[7.8, -4, 20, [40, 0, 0], 3.2], [7.6, 0, 16, [-30, 0, 0], 3], [7.4, 3, 20, [50, 0, 0], 2.5], [6.4, 7, 15, [-40, 0, 0], 2.4]])
    streak([s[0], s[1], s[2]], s[3], s[4], yellow);
  for (s = [[7.6, -6, 15, [10, 0, 0], 1.6], [7, 4, 12, [20, 0, 0], 1.5], [7.4, -1, 23, [-20, 0, 0], 1.4]])
    streak([s[0], s[1], s[2]], s[3], s[4], cyan);
}

// Spiny dorsal crest and a row of yellow spines down the back.
for (i = [0 : 3]) color(navyDk) translate([0, -6 + i * 4.5, 26 - i * 1.6]) rotate([-50, 0, 0]) scale([0.9, 3.5, 7.5 - i * 1.2]) sphere(1, $fn = 12);
mirror_x() for (i = [0 : 4]) spike([2.6, -4 + i * 4, 25 - i * 2], [1.5, 1.6, 3.2 - i * 0.3], 1.1, 0.05, yellow);

// Pectoral fins: long jade feathers streaming up and back like wings, with gold leading edges.
module feather(root, mid, tip, c) {
  color(c) hull() {
    translate(root) sphere(1.1);
    translate(mid) sphere(0.6);
    translate(mid + [0, 2.5, -2]) sphere(0.6);
    translate(tip) sphere(0.3);
  }
  color(gold) hull() { translate(root + [0, -0.5, 0.4]) sphere(0.4); translate(mid + [0, -0.2, 0.4]) sphere(0.35); }
  color(gold) hull() { translate(mid + [0, -0.2, 0.4]) sphere(0.35); translate(tip) sphere(0.25); }
}
mirror_x() {
  feather([7, -2, 21], [13, 1, 28], [17, 8, 36], jade);
  feather([7.5, 0, 18], [15, 3, 23], [21, 10, 26], jadeHi);
  feather([7, 2, 15], [14, 6, 15], [19, 13, 14], jade);
}
// Ragged ventral fins under the jaw and belly.
mirror_x() for (f = [[3.5, -8, 7, 30], [5, -1, 7, 15], [3, 6, 8, 0]]) color(jade) translate([f[0], f[1], f[2]]) rotate([f[3], 25, 0]) scale([0.8, 2.6, 6]) sphere(1, $fn = 12);
color(navyDk) translate([0, -12, 7]) rotate([-30, 0, 0]) scale([0.8, 2, 4]) sphere(1, $fn = 12);

// Tail: tapering, spined, with a forked fin and a cyan glow at its tips.
chain([[0, 13, 13], [0, 18, 12], [0, 22, 13]], [3, 2, 1.4], navy);
for (s = [-1, 1]) color(jade) translate([0, 22, 13]) rotate([s * 45 - 5, 0, 0]) translate([0, 5, 0]) scale([0.9, 6.5, 2.6]) sphere(1, $fn = 14);
for (s = [-1, 1]) ell([0.9, 1.5, 0.9], [0, 22, 13] + [0, 8 * cos(s * 45 - 5), 8 * sin(s * 45 - 5)], cyan);
mirror_x() for (i = [0 : 2]) spike([1.6, 14 + i * 3, 15.5 - i * 0.6], [1.5, 1.2, 2.8], 0.8, 0.05, yellow);
// Streaks on the tail fin.
for (s = [-1, 1]) streak([0.6, 25, 13 + s * 3.5], [s * 45, 0, 0], 2.6, yellow);

// Angler stalk from the brow arching forward to a crackling lure.
lure = [1, -20, 31];
chain([for (t = [0 : 0.125 : 1]) [1 * t, -8 - 12 * t, 26 + 10 * sin(t * 180) + 7.5 * t]], [for (t = [0 : 8]) 0.8 - t * 0.03], navyDk);
ell([2.6, 2.6, 2.6], lure, yellow);
ell([1.4, 1.4, 1.4], lure + [-0.7, -1.5, 0.8], yellowHi);
for (d = [[-1, -0.3, 1], [1, -0.5, 1.2], [-1.2, -0.3, -1], [0.3, -1, -1.3], [-1.4, 0, 0.1], [1.3, 0, -0.4]]) spike(lure + d * 3, d * 1.6, 0.35, 0.05, yellow);

// Gold veins over the armour.
module vein(pts) { chain(pts, [for (p = pts) 0.28], gold); }
mirror_x() {
  vein([[6.5, -9, 22], [7.8, -5, 21], [8.2, -1, 17], [7.8, 3, 18], [6.8, 8, 15]]);
  vein([[8.2, -1, 17], [7.8, 1, 12]]);
  vein([[3, 7, 21], [5, 3, 23.5], [3.5, -2, 26]]);
}
// Halo: a golden ring behind the head with a gem.
color(gold) translate([0, 1, 30]) rotate([90, 0, 0]) rotate_extrude($fn = 40) translate([7.5, 0]) circle(0.55, $fn = 8);
color(gold) translate([0, 1, 37.5]) rotate([90, 0, 0]) cylinder(h = 1, r = 1.4, center = true, $fn = 16);
ell([1, 0.8, 1], [0, 0.3, 37.5], haloGem);
// Sun ring around the lure.
color(gold) translate(lure) rotate([90, 0, 0]) rotate_extrude($fn = 28) translate([3.6, 0]) circle(0.4, $fn = 8);
