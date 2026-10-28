// Galaxion: a hulking charcoal armoured dragon with molten orange seams, a swirling galaxy core in its chest,
// flame-tipped horns, huge clawed forearms and a burning tail.
include <lib.scad>

armor = [0.16, 0.14, 0.15];
armorHi = [0.26, 0.22, 0.22];
seam = [0.95, 0.42, 0.08];
gold = [0.85, 0.62, 0.25];
core = [1, 0.85, 0.4];
coreMid = [1, 0.55, 0.12];
flameRed = [0.93, 0.25, 0.05];
flameOrange = [1, 0.58, 0.1];
flameCore = [1, 0.9, 0.45];
claw = [0.93, 0.88, 0.75];
eyeC = [1, 0.6, 0.1];

module tongue(p, d, r, c) {
  color(c) hull() { translate(p) sphere(r); translate(p + d) sphere(0.15); }
}
module flame(p, s = 1) {
  tongue(p, [0, 0, 5 * s], 1.5 * s, flameRed);
  tongue(p + [0.6 * s, 0, 0], [1.6 * s, 0, 3.6 * s], 1.0 * s, flameRed);
  tongue(p + [-0.6 * s, 0, 0], [-1.4 * s, 0, 3.4 * s], 1.0 * s, flameOrange);
  ell([0.9, 0.9, 1.4] * s, p + [0, -0.5, 1], flameCore);
}

// Torso: broad chest tapering to the waist, hunched forward.
blob([[[9, 6.5, 7], [0, 0, 22]], [[6, 5, 5], [0, 0.5, 15]]], armor);
// Waist plates.
blob([[[5.5, 4.5, 3], [0, 0.5, 12]], [[6.5, 5, 3], [0, 0.5, 10]]], armorHi);
// Orange seam lines across the torso.
for (z = [12.5, 17]) color(seam) translate([0, 0.5, z]) scale([1, 0.8, 1]) cylinder(h = 0.5, r = z > 15 ? 6.6 : 6.9, center = true, $fn = 32);
// Galaxy core: a glowing orb with spiral arms.
ell([4.6, 1.6, 4.6], [0, -5.6, 21], coreMid);
ell([3.6, 1.6, 3.6], [0, -6.4, 21], core);
ell([1.6, 1.2, 1.6], [0, -7.4, 21], [1, 1, 0.85]);
for (a = [0 : 120 : 240]) color(flameRed) translate([0, -7.6, 21]) rotate([90, 0, 0]) rotate([0, 0, a])
  for (t = [0 : 4]) let(r = 1.2 + t * 0.7, ang = t * 32, r2 = 1.9 + t * 0.7, ang2 = t * 32 + 32)
    hull() { translate([r * cos(ang), r * sin(ang), 0]) sphere(0.5, $fn = 8); translate([r2 * cos(ang2), r2 * sin(ang2), 0]) sphere(0.42, $fn = 8); }
// Chest plate rims.
mirror_x() color(seam) translate([5.2, -5, 22]) rotate([0, 20, 20]) scale([0.4, 0.4, 5]) sphere(1, $fn = 10);

// Back ridge spikes.
for (i = [0 : 3]) spike([0, 5 + i * 0.2, 26 - i * 3.6], [0, 3, 1.6], 1.6 - i * 0.2, 0.1, armorHi);
mirror_x() for (i = [0 : 1]) spike([4, 5, 25 - i * 4], [1.5, 2.6, 1.2], 1.3, 0.1, armorHi);

// Shoulder pauldrons with gold sigils.
mirror_x() {
  ell([4.6, 4.4, 3.6], [9.5, 0, 26], armorHi);
  color(seam) translate([9.5, 0, 24.4]) scale([4.4, 4.2, 1]) cylinder(h = 0.8, r = 1.04, center = true, $fn = 28);
  color(gold) translate([11.6, -2, 27]) rotate([0, 60, -30]) difference() { cylinder(h = 0.6, r = 1.6, center = true, $fn = 20); cylinder(h = 1, r = 1, center = true, $fn = 16); }
  ell([0.5, 0.5, 0.5], [11.6, -2.2, 27], gold);
}

// Arms: upper arm, huge plated forearm, long claws hanging low.
mirror_x() {
  limb([10.5, 0, 24], [13, -1, 17], 2.6, 2.4, armor);
  blob([[[3.6, 3.6, 3.2], [13.5, -1.5, 16]], [[3.2, 3.2, 3], [14.5, -2.5, 10]]], armor);
  // forearm shield plate with gold ring
  color(armorHi) translate([16.8, -2, 13]) rotate([0, 10, 0]) scale([1.2, 4, 6]) sphere(1, $fn = 20);
  color(gold) translate([18, -2, 13]) rotate([0, 90, 0]) difference() { cylinder(h = 0.6, r = 2, center = true, $fn = 20); cylinder(h = 1, r = 1.3, center = true, $fn = 16); }
  color(seam) translate([17.9, -2, 13]) scale([0.4, 0.4, 4.8]) sphere(1, $fn = 10);
  ell([2.6, 2.6, 2], [14.6, -3, 7.5], armor);
  for (a = [-35, -10, 15, 40]) chain([[14.6 + sin(a) * 1.8, -3.5 - cos(a) * 1.2, 6.5], [14.8 + sin(a) * 2.6, -4.5 - cos(a) * 1.8, 3.5],
                                      [15 + sin(a) * 2.6, -6 - cos(a) * 1.4, 2]], [0.55, 0.35, 0.08], claw);
}

// Legs: thick armoured thighs, knee plates, clawed feet.
mirror_x() {
  limb([4.5, 1, 11], [6.5, -0.5, 6], 3.6, 3.2, armor);
  ell([2.4, 2, 2.4], [6.7, -3, 6], armorHi);
  color(seam) translate([6.7, -4.7, 6]) scale([1.4, 0.3, 1.4]) sphere(1, $fn = 14);
  limb([6.5, -0.5, 6], [7, 0.5, 2], 2.8, 2.4, armor);
  blob([[[3, 4, 1.5], [7, -2, 1.5]], [[2.4, 2, 1.4], [7, 1, 1.5]]], armor);
  for (a = [-30, 0, 30]) spike([7 + sin(a) * 1.6, -5.6, 1.1], [sin(a) * 0.6, -1.6, -0.6], 0.5, 0.05, claw);
}

// Neck and head: wedge-shaped dragon head jutting forward (scaled up around its neck).
limb([0, 0, 27], [0, -3, 30], 4.2, 3.6, armor);
translate([0, -3, 31]) scale(1.35) translate([0, 3, -31]) {
blob([[[4.4, 4, 3.6], [0, -3, 33]], [[2.8, 3.4, 2.2], [0, -8.5, 31.5]]], armor);
// Lower jaw, glowing mouth and fangs.
blob([[[3.4, 2.6, 1.3], [0, -4, 30]], [[2.2, 2.6, 1], [0, -8, 29.8]]], armorHi);
color(seam) translate([0, -6.5, 30.6]) scale([2.6, 3.4, 0.5]) sphere(1, $fn = 16);
mirror_x() color(seam) translate([2.8, -5, 31.4]) rotate([0, 0, -20]) scale([0.3, 3, 0.3]) sphere(1, $fn = 10);
mirror_x() spike([1.5, -9.4, 30.8], [0, 0, -1.4], 0.45, 0.05, claw);
mirror_x() spike([1.5, -9.2, 30], [0, 0, 1.2], 0.4, 0.05, claw);
// Glowing eyes and brow plates.
mirror_x() {
  eye([2.6, -6.4, 33.4], 1.45, iris = eyeC, pupil = [0.25, 0.05, 0], sclera = [1, 0.85, 0.4], yaw = -25);
  color(armorHi) translate([2.8, -6.8, 34.8]) rotate([0, -20, -25]) scale([2, 0.9, 0.6]) sphere(1, $fn = 14);
}
// Forehead sigil.
color(gold) translate([0, -5.3, 35.3]) rotate([70, 0, 0]) difference() { cylinder(h = 0.5, r = 1.2, center = true, $fn = 18); cylinder(h = 1, r = 0.7, center = true, $fn = 14); }
// Head crest spikes.
for (i = [-1 : 1]) spike([i * 1.4, -1, 35.5], [i * 0.8, 1.5, 2.5], 1, 0.1, armorHi);
// Curved horns ending in flames.
mirror_x() {
  chain([[3, -1.5, 35], [5, -1, 36.5], [6, -0.5, 38.3]], [1.4, 1.1, 0.8], armorHi);
  flame([6, -0.5, 38.3], 1.1);
}
}

// Tail: segmented, sweeping to the viewer's right, wreathed in fire toward the tip.
chain([[2, 5, 10], [7, 9, 7], [13, 9, 6], [18, 6, 7], [21, 2, 9]], [3.2, 2.8, 2.3, 1.8, 1.3], armor);
for (p = [[7, 9, 7], [13, 9, 6], [18, 6, 7]]) color(seam) translate(p) scale([0.9, 0.9, 1]) sphere(2.4, $fn = 16);
for (p = [[7, 9, 7], [13, 9, 6], [18, 6, 7]]) ell([2.6, 2.6, 2.3], p + [0, 0, 0.6], armor);
tongue([21, 2, 9], [1, -0.5, 11], 3.4, flameRed);
tongue([20, 3, 8], [-3, 1, 9], 2.6, flameOrange);
tongue([19, 5, 7], [1, 3, 8], 2.4, flameRed);
tongue([16, 7, 6.5], [0, 2, 7], 2.2, flameOrange);
tongue([13, 9, 6], [-1, 2, 6], 2, flameRed);
tongue([22, 1, 9], [4, -1, 7], 2.2, flameOrange);
ell([2.2, 2.2, 3.4], [21, 1, 11.5], flameCore);
ell([1.6, 1.6, 2.4], [17, 5, 9], flameCore);

// Extra molten seams on the limbs and back.
mirror_x() {
  color(seam) translate([13.6, -1.5, 16]) rotate([0, -10, 0]) scale([3.7, 3.7, 0.5]) sphere(1, $fn = 20);
  color(seam) translate([6.5, -0.5, 8.5]) rotate([0, 20, 0]) scale([3.5, 3.5, 0.5]) sphere(1, $fn = 20);
  color(seam) translate([3, 6.4, 20]) rotate([0, 0, 0]) scale([0.4, 0.5, 5]) sphere(1, $fn = 10);
}
color(seam) translate([0, 6.6, 18]) scale([4, 0.5, 0.4]) sphere(1, $fn = 14);
