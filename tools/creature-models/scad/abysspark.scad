// Abysspark: the deep-sea apex of the Glimfin line. A spiny navy anglerfish with yellow lightning streaks and cyan
// flecks, a gaping toothy red maw, wing-like pectoral fins, a row of yellow spines down its back and tail, and a
// crackling yellow lure.
include <lib.scad>

navy = [0.1, 0.18, 0.45];
navyDk = [0.06, 0.1, 0.3];
navyHi = [0.2, 0.32, 0.62];
cyan = [0.25, 0.8, 0.9];
yellow = [1, 0.82, 0.15];
yellowHi = [1, 0.97, 0.65, GLOW];
maw = [0.65, 0.08, 0.1];
tooth = [0.95, 0.95, 0.92];
dark = [0.04, 0.05, 0.12];

// Body: a heavy wedge, head forward (-Y), tapering to the tail.
blob([[[8, 9, 9], [0, -5, 18]], [[7, 7, 7.5], [0, 4, 16]], [[3.2, 4, 3.5], [0, 13, 13]]], navy);
// Heavy brow ridge.
blob([[[6.5, 4, 2.2], [0, -8.5, 24.5]], [[3.5, 2.5, 1.6], [0, -11.5, 23.6]]], navyDk);
// Lower jaw.
blob([[[6.8, 4, 3], [0, -10, 11.5]], [[5, 3, 2.2], [0, -14.5, 12]]], navy);
// Gaping maw: red gullet, white fangs up and down.
color(maw) translate([0, -13.5, 15.5]) scale([5.2, 3, 3]) sphere(1, $fn = 20);
for (i = [0 : 5]) {
  x = -4 + i * 1.6;
  spike([x, -15.4 + abs(x) * 0.25, 18.3], [0, -0.2, -2], 0.55, 0.05, tooth);
  spike([x, -15.6 + abs(x) * 0.25, 13], [0, -0.2, 1.8], 0.5, 0.05, tooth);
}
// Pale cheek plates.
mirror_x() ell([1, 3, 1.4], [5.2, -11.8, 13], [0.85, 0.88, 0.92]);
// Eye sunk into the skull: turned `yaw` outward along the skin and squashed front-to-back so only its face shows, set
// in a dark socket under a hard brow ridge of the skin colour that slants down to the snout, so the face itself scowls.
module socket_eye(p, size, yaw, iris, sclera, pupil, skin, sock, lid = 0.5, tilt = 30, squash = 0.6) {
  translate(p) rotate([0, 0, yaw]) {
    color(sock) translate([0, size * 0.45, -size * 0.05]) scale([1.14, 0.55, 1.12]) sphere(size, $fn = 20);
    scale([1, squash, 1]) eye([0.01, 0, 0], size, iris = iris, sclera = sclera, pupil = pupil, lid = lid, lid_tilt = tilt,
                              lid_c = skin, slit = 0.35);
    // The ridge is a wedge rooted behind the eye, so it reads as a ledge of the skull, not a stuck-on bar.
    color(skin) hull() {
      translate([size * 0.8, size * 0.25, size * 0.78]) scale([0.32, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([-size * 0.9, -size * 0.45, size * 0.12]) scale([0.36, 0.45, 0.24]) sphere(size, $fn = 12);
      translate([0, size * 0.9, size * 0.45]) scale([0.9, 0.5, 0.4]) sphere(size, $fn = 12);
    }
  }
}
// Narrow glaring eyes: glowing yellow slits sunk under the heavy brow.
mirror_x() socket_eye([4.7, -11.7, 21.1], 2.2, 30, [1, 0.85, 0.1, GLOW], [1, 0.93, 0.35], dark, navyDk, dark, lid = 0.5, tilt = 32);

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

// Pectoral fins: dark wings with cyan-tipped rays.
mirror_x() {
  color(navyHi) hull() {
    translate([7, -2, 17]) sphere(1.5);
    translate([18, 4, 21]) sphere(0.4);
    translate([17, 6, 14]) sphere(0.4);
    translate([12, 6, 11]) sphere(0.4);
  }
  for (t = [[18, 4, 21], [17.5, 5.3, 17], [16, 6, 13.5]]) ell([0.9, 0.9, 0.9], t, cyan);
}
// Ragged ventral fins under the jaw and belly.
mirror_x() for (f = [[3.5, -8, 7, 30], [5, -1, 7, 15], [3, 6, 8, 0]]) color(navyDk) translate([f[0], f[1], f[2]]) rotate([f[3], 25, 0]) scale([0.8, 2.2, 5]) sphere(1, $fn = 12);
color(navyDk) translate([0, -12, 7]) rotate([-30, 0, 0]) scale([0.8, 2, 4]) sphere(1, $fn = 12);

// Tail: tapering, spined, with a forked fin and a cyan glow at its tips.
chain([[0, 13, 13], [0, 18, 12], [0, 22, 13]], [3, 2, 1.4], navy);
for (s = [-1, 1]) color(navyHi) translate([0, 22, 13]) rotate([s * 45 - 5, 0, 0]) translate([0, 4, 0]) scale([0.9, 5, 2.2]) sphere(1, $fn = 14);
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
