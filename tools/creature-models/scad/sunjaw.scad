// Sunjaw: a muscular golden lion brawler with a blazing spiky mane, a white scarf trailing off its shoulders,
// a red waist sash, huge bronze gauntlets studded with glowing embers and a tufted tail.
include <lib.scad>

fur = [0.93, 0.66, 0.16];
furHi = [1, 0.8, 0.3];
furDark = [0.78, 0.48, 0.1];
mane = [0.98, 0.74, 0.18];
maneDark = [0.88, 0.55, 0.1];
red = [0.75, 0.1, 0.08];
redDark = [0.55, 0.06, 0.05];
bronze = [0.35, 0.25, 0.18];
bronzeHi = [0.55, 0.4, 0.25];
ember = [1, 0.5, 0.1];
scarf = [0.92, 0.9, 0.85];
claw = [0.95, 0.92, 0.85];
nose = [0.4, 0.2, 0.12];

// Legs: thick thighs, digitigrade shins, clawed paws.
mirror_x() {
  limb([4, 0, 13], [5.5, -2, 8], 4, 3.2, fur);
  limb([5.5, -2, 8], [5.8, 0.5, 3.5], 2.8, 2, fur);
  blob([[[2.6, 3.4, 1.5], [6, -1.5, 1.5]]], fur);
  for (a = [-30, 0, 30]) spike([6 + sin(a) * 1.3, -4.4, 1], [sin(a) * 0.5, -1.2, -0.4], 0.42, 0.05, claw);
}

// Torso: broad muscular chest, narrow waist.
blob([[[7.5, 5, 5.5], [0, 0, 23]], [[5, 4, 4], [0, 0, 16]]], fur);
// Pecs and abs.
mirror_x() ell([3.2, 1.4, 2.4], [2.6, -4, 23], furHi);
for (z = [16.5, 18.5]) mirror_x() ell([1.3, 0.8, 0.9], [1.3, -3.7, z], furHi);
// Back: lats, shoulder blades and a spine groove so the back is not a plain blob; a pale scar across the chest.
mirror_x() ell([3.4, 1.4, 3.6], [3, 4, 22.5], furHi);
mirror_x() ell([1.8, 1, 1.6], [2.6, 4.6, 26], furHi);
color(furDark) hull() { translate([0, 5, 27]) sphere(0.35, $fn = 8); translate([0, 4.3, 17]) sphere(0.35, $fn = 8); }
for (i = [0 : 2]) color(claw) translate([-2.5 + i * 0.6, -4.95, 25 - i * 1.5]) rotate([0, 50, 0]) scale([1.1, 0.25, 0.18]) sphere(1, $fn = 8);
// Thigh muscles.
mirror_x() ell([2.2, 1.6, 2.6], [4.7, -2.4, 11], furHi);
// Red sash and hanging loincloth.
color(red) translate([0, 0, 14.5]) scale([5.6, 4.6, 1]) cylinder(h = 3, r = 1, center = true, $fn = 28);
color(redDark) translate([0, -4.5, 15]) scale([1.5, 0.8, 1.2]) sphere(1, $fn = 14);
// the knot's two trailing ends
for (s = [-1, 1]) color(redDark) hull() { translate([s * 0.6, -4.9, 14.5]) sphere(0.6, $fn = 8); translate([s * 1.6, -5.4, 10.5]) scale([0.9, 0.3, 0.4]) sphere(1, $fn = 8); }
color(red) hull() { translate([0, -4.2, 14]) scale([4, 0.5, 1]) sphere(1, $fn = 14); translate([0, -4.8, 8]) scale([3.4, 0.4, 0.5]) sphere(1, $fn = 14); }
color(red) hull() { translate([0, 4.2, 14]) scale([4, 0.5, 1]) sphere(1, $fn = 14); translate([0, 4.8, 8.5]) scale([3.6, 0.4, 0.5]) sphere(1, $fn = 14); }
mirror_x() color(red) hull() { translate([4.2, 0, 13.5]) scale([0.5, 3.4, 1]) sphere(1, $fn = 12); translate([5.2, -0.6, 9.5]) scale([0.4, 3, 0.5]) sphere(1, $fn = 12); }

// Arms: big shoulders and biceps, then huge bronze gauntlets.
mirror_x() {
  ell([3.4, 3.4, 3.2], [8, 0, 26], fur);
  limb([8.5, 0, 25], [11, -1, 19.5], 2.8, 2.4, fur);
  ell([2.4, 2.4, 2.6], [10, -1.5, 22.5], furHi);
  // fur ruff where the forearm enters the gauntlet
  for (a = [0 : 60 : 300]) spike([12 + 1.6 * cos(a), -1.3 + 1.6 * sin(a), 19.2], [cos(a) * 0.6, sin(a) * 0.6, 1.6], 0.8, 0.1, mane);
  // gauntlet: a chunky bronze drum around the forearm and fist
  translate([12.5, -2.5, 15.5]) rotate([20, 0, 0]) {
    color(bronze) cylinder(h = 6.5, r = 4.2, center = true, $fn = 28);
    for (z = [-2.6, 0, 2.6]) color(bronzeHi) translate([0, 0, z]) cylinder(h = 0.7, r = 4.5, center = true, $fn = 28);
    color(bronze) translate([0, -0.6, -3.6]) scale([3.8, 3.8, 2]) sphere(1, $fn = 22);
    // knuckle plates
    for (i = [-1.5, 0, 1.5]) color(bronzeHi) translate([i * 1.3, -3.6, -3.6]) scale([1.1, 0.9, 1]) sphere(1, $fn = 12);
    // claws jutting from the fist
    for (i = [-1.5, 0, 1.5]) spike([i * 1.3, -4.2, -4.4], [0, -1.2, -0.9], 0.38, 0.04, claw);
    // glowing ember studs around the drum
    for (a = [-170 : 34 : 10]) for (z = [-1.3, 1.3]) color(ember) translate([4.4 * cos(a), 4.4 * sin(a), z]) sphere(0.75, $fn = 10);
  }
  // little flame wisps off the gauntlet
  for (k = [0 : 1]) color(ember) hull() { translate([16.6, -2.5, 15 + k * 3]) sphere(0.7, $fn = 8); translate([18.6, -2.5, 17 + k * 3]) sphere(0.1, $fn = 6); }
}

// Neck and lion head.
limb([0, 0, 27], [0, -1.5, 30], 3, 2.8, fur);
translate([0, -1, 29]) scale(1.3) translate([0, 1, -29]) {
blob([[[4, 3.6, 3.8], [0, -2, 32.5]], [[2.6, 2.2, 1.8], [0, -5.4, 31]]], fur);
// Muzzle, nose, open snarling mouth with fangs.
mirror_x() ell([1.5, 1.3, 1.2], [0.9, -6.6, 30.8], furHi);
ell([0.9, 0.6, 0.6], [0, -7.5, 31.6], nose);
ell([1.6, 0.8, 0.5], [0, -6.6, 29.6], redDark);
mirror_x() spike([0.8, -7, 30.2], [0, -0.1, -1.1], 0.32, 0.05, claw);
mirror_x() spike([0.6, -6.9, 29.1], [0, -0.1, 0.8], 0.25, 0.05, claw);
// Fierce eyes sunk under a heavy scowling brow, in dark sockets.
mirror_x() {
  ell([1.45, 0.5, 1.35], [2, -4.85, 33.35], nose);
  eye([2, -5.3, 33.2], 1.2, iris = [1, 0.85, 0.1], pupil = [0.12, 0.03, 0], sclera = [0.95, 0.4, 0.05], yaw = -12,
      lid = 0.42, lid_tilt = 30, lid_c = [0.55, 0.3, 0.08], slit = 0.35, squint = 0.12);
  // brow ridge: a hulled wedge overhanging the eye, slanting down to the nose
  color(fur) hull() {
    translate([0.7, -5.6, 34.15]) scale([0.5, 0.5, 0.4]) sphere(1, $fn = 12);
    translate([2.1, -5.45, 34.85]) scale([0.9, 0.6, 0.42]) sphere(1, $fn = 12);
    translate([3.4, -4.4, 35.3]) scale([0.6, 0.6, 0.45]) sphere(1, $fn = 12);
  }
  // snarl wrinkles on the muzzle bridge
  for (i = [0 : 1]) color(furDark) translate([0.55, -6.9 + i * 0.35, 32.3 + i * 0.5]) rotate([0, -20, 20]) scale([0.5, 0.2, 0.14]) sphere(1, $fn = 8);
  ell([1, 0.6, 1.1], [3.2, -2.5, 35.5], furDark);
}
// The mane: spiky flame-like locks radiating around and behind the head.
for (k = [0 : 13]) let(a = k * 360 / 14, up = 0.5 + 0.5 * cos(a), c = k % 2 == 0 ? mane : maneDark)
  chain([[3.6 * sin(a), -0.5, 32 + 3.6 * cos(a)], [6.6 * sin(a), 1.5, 32 + 6.4 * cos(a) + 1], [8.2 * sin(a) + 1.5 * cos(a), 4, 32 + 8 * cos(a) + 2.5]],
        [3, 2, 0.3], c);
for (k = [0 : 6]) let(a = -60 + k * 20)
  chain([[3 * sin(a), 2, 35], [5 * sin(a), 5, 37], [6.5 * sin(a), 9, 36]], [3, 2, 0.3], k % 2 == 0 ? mane : maneDark);
ell([6, 5, 6], [0, 2, 32], maneDark);
for (k = [0 : 7]) let(a = k * 45 + 20)
  chain([[3 * sin(a), 4, 32 + 3 * cos(a)], [5 * sin(a), 7.5, 31 + 4 * cos(a)], [5.5 * sin(a), 10, 29 + 4 * cos(a)]], [2.4, 1.5, 0.3], k % 2 == 0 ? mane : maneDark);
// Bangs over the forehead.
for (x = [-1.8, 0, 1.8]) spike([x, -3.4, 35], [x * 0.3, -2.2, 0.8], 1.1, 0.1, mane);
}

// White scarf: a puffy cloud loop around the shoulders streaming off both sides.
module puffs(pts, rs) { color(scarf) for (i = [0 : len(pts) - 1]) translate(pts[i]) scale([1, 0.9, 0.85]) sphere(rs[i] * 1.25, $fn = 14); }
puffs([[-6, -2, 27], [-3.5, -4.4, 26.5], [0, -5, 26.5], [3.5, -4.4, 26.5], [6.5, -1, 27.5], [5, 3.8, 28], [0, 4.6, 27.5], [-5, 3.4, 27.5]],
      [2, 1.8, 1.8, 1.8, 2.1, 2, 2, 2]);
puffs([[9, 3, 30], [12, 4.5, 32.5], [15, 4, 34], [17.5, 5, 32], [19, 4, 35]], [2.4, 2.6, 2.2, 1.8, 1.3]);
puffs([[-8.8, 3, 29], [-11.5, 3.5, 30.5], [-13.5, 4.5, 29], [-15, 3.5, 30.5]], [2.2, 2, 1.6, 1.1]);

// Tail curling out to the viewer's right with a mane-coloured tuft.
chain([[0, 4, 12], [4, 8, 7], [9, 8, 3], [13, 5, 3], [14, 2, 6]], [1.4, 1.2, 1.1, 1, 0.9], fur);
for (d = [[0, -1, 3], [1.5, 0, 2.6], [-1, 0.5, 2.6], [0.5, 1.5, 2.4]]) spike([14, 2, 6], d, 1.3, 0.1, mane);
