// Bankaiser: a cloaked reaper in a shaggy mantle of black feathers, a white bone skull-helm with a single horn and
// red eyes, a red gem on its breastplate, armoured legs with red talons, a huge white crescent blade and red wisps.
include <lib.scad>

black = [0.1, 0.1, 0.12];
feather = [0.2, 0.2, 0.23];
featherHi = [0.32, 0.32, 0.36];
bone = [0.88, 0.88, 0.86];
boneDark = [0.62, 0.62, 0.62];
armor = [0.45, 0.45, 0.5];
red = [0.85, 0.1, 0.12];
redDark = [0.6, 0.06, 0.08];
gem = [1, 0.15, 0.2];

// Feather: a flat pointed petal from p along direction d.
module feather(p, d, w, c) {
  color(c) hull() { translate(p) scale([w, w * 0.45, w]) sphere(1, $fn = 10); translate(p + d) sphere(0.12, $fn = 6); }
}

// Armoured legs with red talons.
mirror_x() {
  limb([3.6, 0, 12], [4.6, -1.5, 6.5], 2.8, 2.2, black);
  ell([1.8, 1.5, 2], [4.7, -3, 6.8], armor);
  limb([4.6, -1.5, 6.5], [4.8, 0, 2.5], 2, 1.7, armor);
  blob([[[2.2, 3, 1.4], [5, -1.4, 1.3]]], black);
  for (a = [-30, 0, 30]) spike([5 + sin(a) * 1.3, -4.2, 1], [sin(a) * 0.6, -1.4, -0.4], 0.45, 0.05, red);
  color(red) translate([4.7, -3.3, 4.5]) scale([1.4, 0.3, 0.3]) sphere(1, $fn = 10);
}

// Body under the mantle: bone breastplate with the red gem.
blob([[[5.5, 4, 5], [0, 0, 21]], [[4.5, 3.4, 4], [0, 0, 15]]], black);
blob([[[3.6, 1.6, 3.6], [0, -2.8, 21]], [[2.4, 1.4, 2.4], [0, -2.6, 16.5]]], bone);
for (z = [15.5, 17.5]) mirror_x() ell([1.2, 0.6, 0.8], [1.2, -3.9, z], boneDark);
color(red) translate([0, -3.6, 22]) scale([4.2, 1.6, 0.6]) sphere(1, $fn = 16);
color(gem) translate([0, -4.6, 22.2]) scale([1, 0.7, 1.3]) sphere(1.5, $fn = 6);
color([1, 0.7, 0.7]) translate([0.4, -5.6, 22.8]) sphere(0.35, $fn = 8);

// Feather mantle: a high collar around the head, a cape and shaggy skirt of drooping feathers.
// Collar ring.
for (k = [0 : 15]) let(a = k * 360 / 16, bk = cos(a) < -0.3 ? 0 : 1)
  if (bk == 1 || abs(sin(a)) > 0.75)
    feather([5.2 * sin(a), 5 * cos(a) + 0.5, 26], [4 * sin(a), 2.5 * cos(a) + 2, 3.5 + (k % 2) * 1.5], 2.2, k % 3 == 0 ? featherHi : feather);
// Shoulder and cape layers (open at the front so the breastplate shows).
for (layer = [0 : 2]) for (k = [0 : 13]) let(a = -150 + k * 300 / 13, r = 6 + layer * 1.6, z = 25 - layer * 5.5)
  if (!(abs(a) > 140 && layer > 0))
    feather([r * sin(a), r * cos(a) * 0.8 + 1.5, z], [3.5 * sin(a), 2.5 * cos(a) + 1.5, -6.5 - layer], 2.5, (k + layer) % 3 == 0 ? featherHi : feather);
// Skirt: long drooping feathers around the hips and down past the knees.
for (k = [0 : 15]) let(a = k * 360 / 16, front = cos(a) < -0.6)
  if (!front)
    feather([6 * sin(a), 5.5 * cos(a) + 0.5, 14], [3 * sin(a), 3 * cos(a), -10], 2.6, k % 2 == 0 ? feather : black);
// Two front panels flanking the legs.
mirror_x() for (i = [0 : 2]) feather([2.5 + i * 1.4, -4, 14], [0.8 + i * 0.6, -0.5, -9 + i], 2, i % 2 == 0 ? black : feather);

// Arms: a bone gauntlet on the viewer-right side; the viewer-left arm grips the blade.
limb([6, 0, 23], [8, -2, 17], 1.8, 1.5, black);
limb([8, -2, 17], [8.5, -3.5, 13], 1.5, 1.4, bone);
for (a = [-30, 0, 30]) spike([8.5 + sin(a) * 0.7, -3.8, 12.3], [sin(a) * 0.5, -0.7, -1.4], 0.32, 0.05, red);
limb([-6, 0, 23], [-9, -2, 18.5], 1.8, 1.5, black);
limb([-9, -2, 18.5], [-11, -3, 16], 1.5, 1.4, bone);

// The crescent blade, standing on the viewer's left: a fat moon sickle with a dark inner edge.
translate([-12, -2.5, 19]) rotate([0, 0, 15]) rotate([68, 0, 0]) {
  color(bone) linear_extrude(height = 1.4, center = true) difference() {
    circle(14, $fn = 56);
    translate([4, 0]) circle(13, $fn = 56);
    translate([16, 0]) square(30, center = true);
  }
  // dark hollow-ground strip along the inner edge
  color(boneDark) translate([0, 0, 0.3]) linear_extrude(height = 1.4, center = true) difference() {
    translate([4, 0]) circle(13.8, $fn = 56);
    translate([4, 0]) circle(13, $fn = 56);
    translate([16, 0]) square(30, center = true);
    difference() { square(40, center = true); circle(14, $fn = 56); }
  }
}
// Grip.
limb([-11.5, -3, 18], [-11.5, -3, 14], 0.8, 0.8, black);

// Head: a long white skull-helm facing -Y, red eyes, one swept horn; feathers tumbling from behind it.
translate([0, -0.8, 29.5]) scale(1.25) {
  ell([3.4, 3.4, 3.4], [0, 1.5, 0.4], black);
  blob([[[2.8, 2.8, 2.8], [0, -0.5, 0.6]], [[1.7, 2.2, 1.5], [0, -4, -0.6]]], bone);
  mirror_x() {
    ell([0.95, 0.5, 0.6], [1.35, -2.8, 0.9], black);
    ell([0.55, 0.35, 0.4], [1.4, -3.15, 0.95], gem);
  }
  for (x = [-0.8, 0, 0.8]) spike([x, -5.2, -1.2], [0, 0, -0.9], 0.3, 0.05, bone);
  ell([1.2, 0.4, 0.4], [0, -5.4, -0.6], black);
  // Single horn rising from the brow, curving back.
  chain([[0.6, -1.5, 2.8], [1.2, -0.8, 5.5], [1.6, 0.8, 7.5], [1.4, 2.4, 8.2]], [1.0, 0.75, 0.45, 0.12], bone);
  // Shaggy hair behind the skull.
  for (k = [0 : 6]) let(a = -75 + k * 25)
    feather([2.8 * sin(a), 2, 2], [5 * sin(a), 5, -2.5 + (k % 2) * 3], 1.8, k % 2 == 0 ? black : feather);
}

// Red wisps curling around the lower body and the blade.
chain([[-8, -2, 4], [-4, -5, 2.5], [1, -5.5, 3.5], [5, -4, 2.5], [9, -2, 4], [11, 1, 6]], [0.7, 0.8, 0.7, 0.8, 0.7, 0.3], red);
chain([[9, 3, 10], [12, 4, 13], [11, 6, 16], [13, 6, 19]], [0.7, 0.6, 0.5, 0.2], redDark);
chain([[-10, 3, 26], [-8, 4, 29], [-10, 5, 32], [-8.5, 5, 34]], [0.7, 0.6, 0.5, 0.2], red);
chain([[8, 2, 27], [10, 3, 29], [9, 4, 32]], [0.6, 0.5, 0.2], red);
// Red feathers fringing the collar at the front.
mirror_x() for (i = [0 : 2]) feather([2.5 + i * 1.6, -3.8 + i * 0.4, 24.5 - i * 0.4], [1.5 + i * 0.6, -1.4, -3.5], 1.3, i == 1 ? redDark : red);
