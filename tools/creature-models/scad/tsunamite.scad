// Tsunamite: Tidespine grown into a hulking teal spinosaur: a long crocodile snout full of teeth, dark horns, green
// eyes, a cream belly, a great purple-teal webbed sail, purple crystal armour on its forearms and hips, a stone-studded
// paddle at the tail tip and a blue gem on its back, standing in a puddle with bubbles rising.
include <lib.scad>

teal = [0.13, 0.55, 0.62];
tealHi = [0.25, 0.68, 0.72];
tealDk = [0.1, 0.36, 0.48];
cream = [0.93, 0.86, 0.62];
purple = [0.42, 0.3, 0.6];
purpleHi = [0.56, 0.45, 0.75];
purpleDk = [0.28, 0.2, 0.42];
sailTeal = [0.25, 0.55, 0.58];
horn = [0.16, 0.18, 0.22];
claw = [0.2, 0.22, 0.26];
rock = [0.42, 0.52, 0.54];
rockDk = [0.33, 0.38, 0.45];
gem = [0.4, 0.85, 1];
water = [0.62, 0.84, 0.92];
bubble = [0.82, 0.94, 1];

// Puddle.
color(water) scale([16, 13, 1]) cylinder(h = 0.25, r = 1, $fn = 32);

// Torso: heavy, leaning slightly forward, cream belly.
blob([[[7, 6.5, 7], [0, 1.5, 13]], [[5.2, 5, 5], [0, -1, 21]]], teal);
blob([[[4.6, 2.6, 5.6], [0, -4.2, 12.5]], [[3, 2.2, 3.6], [0, -4.4, 20.5]]], cream);
// Belly plates.
for (z = [9 : 2.6 : 22]) color([0.82, 0.74, 0.5]) translate([0, -6.5 + abs(z - 15) * 0.08, z]) scale([3.4 - abs(z - 14) * 0.15, 0.4, 0.15]) sphere(1, $fn = 14);

// Neck and head: long croc snout with teeth.
chain([[0, -1, 22], [0, -3, 26], [0, -4, 28.5]], [4, 3.4, 3.2], teal);
ell([3.4, 2.6, 3], [0, -4, 25.5], cream);
blob([[[3.8, 3.8, 3.2], [0, -4, 30.5]], [[2.2, 5, 1.6], [0, -11, 29.6]]], teal);
blob([[[3, 3.4, 1.3], [0, -5, 28]], [[1.8, 5, 1], [0, -11, 28.2]]], cream);
color(tealDk) translate([0, -9.5, 28.9]) scale([2.2, 6.4, 0.25]) sphere(1, $fn = 20);
// Teeth along both jaws.
mirror_x() for (i = [0 : 4]) {
  y = -7 - i * 1.7;
  spike([1.9 - i * 0.08, y, 29], [0, 0, -0.9], 0.3, 0.02, [1, 1, 0.95]);
  spike([1.7 - i * 0.08, y - 0.8, 28.7], [0, 0, 0.8], 0.28, 0.02, [1, 1, 0.95]);
}
mirror_x() ell([0.3, 0.3, 0.3], [0.9, -15.6, 30.2], tealDk);
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
// Eyes (bright green slits in dark sockets under a teal brow ridge) and horns.
mirror_x() {
  socket_eye([2.3, -6.6, 32.6], 1.7, 28, [0.35, 1, 0.3], [0.95, 0.95, 0.62], [0.02, 0.08, 0.02], teal, [0.04, 0.12, 0.16],
             lid = 0.38, tilt = 30);
  spike([2.4, -2.6, 32.6], [1.2, 1.8, 3.6], 0.9, 0.1, horn);
  spike([3.4, -1.2, 31.6], [2, 2.2, 1.8], 0.7, 0.1, horn);
}

// Sail: webbed ribs from the shoulders down the back, purple membrane with teal sheen, splayed into a slight V.
ribs = [[-14, 12], [0, 16], [14, 18], [28, 18], [42, 16], [56, 13], [70, 9]];
mirror_x() rotate([0, 6, 0]) for (i = [0 : len(ribs) - 2]) {
  a0 = ribs[i][0]; l0 = ribs[i][1]; a1 = ribs[i + 1][0]; l1 = ribs[i + 1][1];
  b0 = [0.4, 4 + i * 1.6, 17 - i * 1.4]; b1 = [0.4, 4 + (i + 1) * 1.6, 17 - (i + 1) * 1.4];
  color([purple, sailTeal, purpleHi][i % 3]) hull() {
    translate(b0) sphere(0.6);
    translate(b0 + [0, sin(a0), cos(a0)] * l0) sphere(0.4);
    translate(b1) sphere(0.6);
    translate(b1 + [0, sin(a1), cos(a1)] * l1) sphere(0.4);
  }
}
for (r = [0 : len(ribs) - 1]) mirror_x() rotate([0, 6, 0]) limb([0.6, 4 + r * 1.6, 17 - r * 1.4], [0.6, 4 + r * 1.6, 17 - r * 1.4] + [0, sin(ribs[r][0]), cos(ribs[r][0])] * ribs[r][1], 0.55, 0.3, purpleDk);
// Blue gem on the back.
ell([1.3, 0.9, 1.5], [3.6, 6.4, 12.5], gem);
mirror_x() for (r = [[4.5, 6, 16], [5.5, 5, 9.5]]) ell([1.2, 1, 1.2], r, rockDk);

// Arms: purple crystal gauntlets, big dark claws.
mirror_x() {
  chain([[5.5, -2, 21.5], [8, -3.5, 17], [8.4, -6, 14.5]], [2.2, 1.9, 1.6], teal);
  color(purple) translate([8.2, -4.6, 16]) rotate([40, 0, 15]) cylinder(h = 4.6, r1 = 3, r2 = 2.3, $fn = 6, center = true);
  // Crystal shards jutting out of the gauntlet, pale facets on the dark.
  spike([9.4, -3.8, 17], [1.8, 0.8, 1.6], 0.9, 0.1, purpleHi);
  spike([9.8, -5.2, 15.2], [2.2, -0.4, 0.2], 0.8, 0.1, purpleHi);
  spike([8, -3, 18.2], [0.4, 1.2, 2], 0.7, 0.1, purpleDk);
  ell([1.8, 1.6, 1.4], [8.6, -7, 13.6], teal);
  for (t = [-35, 0, 35]) chain([[8.6 + sin(t) * 1.2, -8.2, 13.6], [8.8 + sin(t) * 1.6, -9.4, 12.6], [8.8 + sin(t) * 1.6, -9.4, 11]], [0.55, 0.4, 0.1], claw);
}

// Legs: massive thighs with purple crystal hip plates, clawed feet.
mirror_x() {
  ell([4, 4.6, 5], [5, 0.5, 8.5], teal);
  color(purple) translate([7.6, -1.4, 10.4]) rotate([0, 65, -20]) cylinder(h = 3, r1 = 2.6, r2 = 1.6, $fn = 6, center = true);
  spike([8.6, -1.6, 10.6], [1.6, -0.4, 2.2], 0.9, 0.1, purpleHi);
  ell([1, 0.8, 1], [6.4, -3.2, 7.6], rock);
  chain([[5.4, 1, 5], [5.6, 2, 2.6], [5.6, -0.2, 1.1]], [2.8, 1.9, 1.6], teal);
  blob([[[2.5, 3.6, 1.2], [5.6, -2.2, 1.2]], [[1.8, 1.8, 1.1], [5.6, 1.2, 1.1]]], teal);
  for (t = [-30, 0, 30]) spike([5.6 + sin(t) * 1.6, -5.4, 0.9], [sin(t) * 0.6, -1.6, -0.5], 0.6, 0.05, claw);
}

// Tail: long, sweeping back to the viewer's right and up, ending in a stone-studded paddle.
tail = [[0, 5, 10], [3, 10, 6.5], [8, 13, 5.5], [13, 13, 8], [15.5, 11, 12.5], [16, 9.5, 17]];
chain(tail, [4, 3.2, 2.5, 1.9, 1.5, 1.2], teal);
for (i = [1 : 4]) ell([1.2, 1, 0.5], tail[i] + [0, 0, -1.6], cream);
color([0.36, 0.5, 0.52]) translate([16, 9.5, 21]) rotate([0, 0, 30]) scale([3.4, 1.1, 5]) sphere(1, $fn = 24);
for (p = [[-1.2, 1.5], [1.2, 0], [0, 3], [-0.6, -2], [1.4, 2.4]]) color(rock) translate([16, 9.5, 21]) rotate([0, 0, 30]) translate([p[0] * 1.6, -1, p[1] * 1.3]) scale([0.8, 0.5, 0.9]) sphere(1, $fn = 12);
for (p = [[0, 1.6, 0], [0, -1.6, 0]]) color(rock) translate([16, 9.5, 21]) rotate([0, 0, 30]) translate([p[0], p[1] * 0.7, 0.5]) scale([1.4, 0.4, 1.6]) sphere(1, $fn = 12);

// Bubbles.
for (b = [[12, 2, 22, 0.8], [13.5, 3, 26, 0.6], [11, 4, 18, 0.5], [-12, 2, 10, 0.6], [-10, -6, 4, 0.5], [9, -8, 3, 0.5]]) ell([b[3], b[3], b[3]], [b[0], b[1], b[2]], bubble);

// Scale cracks over the back: a net of short dark lines across the torso's back and down the tail, like the sprite's
// crackled hide, so the back isn't one smooth teal blob.
function back_pt(a, z) = let(t = (z - 13) / 8, rx = 7 - 1.8 * t, ry = 6.5 - 1.5 * t, cy = 1.5 - 2.5 * t)
  [rx * sin(a) * 1.0, cy + ry * cos(a) * 1.0, z];
for (z = [12 : 3 : 18]) for (a = [-84 : 24 : 60]) let(o = (z % 2) * 12) {
  limb(back_pt(a + o, z), back_pt(a + o + 24, z), 0.22, 0.22, tealDk);
  limb(back_pt(a + o, z), back_pt(a + o + 6, z + 3), 0.22, 0.22, tealDk);
}
// Dark scutes along the top of the tail.
for (i = [0 : len(tail) - 3]) for (t = [0.25, 0.75]) let(p = tail[i] + (tail[i + 1] - tail[i]) * t)
  color(tealDk) translate(p + [0, 0, [4, 3.2, 2.5, 1.9, 1.5][i] * 0.9]) scale([0.9, 1.2, 0.5]) sphere(1, $fn = 10);
