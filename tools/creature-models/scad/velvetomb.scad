// Velvetomb: a towering velvet-purple phantom in a flared cloak, a white pointed mask under a tall cowl, smoke
// curling off its head and shoulders, a pale cloud at its hem and a glowing violet orb in one hand.
include <lib.scad>

cloak = [0.3, 0.14, 0.36];
cloakDk = [0.18, 0.08, 0.24];
cloakHi = [0.46, 0.27, 0.52];
mask = [0.95, 0.93, 0.97];
maskSh = [0.74, 0.68, 0.8];
smoke = [0.86, 0.8, 0.9];
smokeDk = [0.62, 0.52, 0.7];
orb = [0.88, 0.8, 1];
orbCore = [1, 0.97, 1];
claw = [0.5, 0.44, 0.55];
red = [0.6, 0.1, 0.4];

// Cloak: a wide bell from the shoulders to a flared hem.
blob([[[7, 5.5, 4], [0, 0, 26]], [[11, 9, 4], [0, 0.5, 13]], [[13, 11, 2], [0, 1, 6]]], cloak);
// Folds on the cloak.
for (a = [-150 : 30 : 150]) color(a % 60 == 0 ? cloakDk : cloakHi) hull() {
  translate([5.5 * sin(a), 0.5 - 4.5 * cos(a), 25]) sphere(0.8);
  translate([12.6 * sin(a), 1 - 10.6 * cos(a), 6.5]) sphere(1.2);
}
// Smoke cloud billowing round the hem.
for (a = [0 : 36 : 359]) ell([4, 4, 2.8], [11.5 * sin(a), 1 + 10 * cos(a), 5.5], (a / 36) % 2 == 0 ? smoke : smokeDk);
// Talon feet under the cloud.
mirror_x() { limb([4, -4, 4], [4.5, -7, 1.2], 0.9, 0.6, claw); for (t = [-30, 0, 30]) spike([4.5, -7, 1.2], [sin(t) * 1.5, -2.6, -1.1], 0.5, 0.05, claw); }

// Cowl and head.
blob([[[5, 5, 5], [0, 0.5, 32]], [[3.5, 3.5, 6], [0, 1.5, 36]]], cloak);
// Tall cowl peak.
spike([-1, 0.5, 37], [-1.5, 0, 5], 2.4, 0.3, cloakDk);
// Mask: pointed white shield, angled brows.
color(mask) hull() {
  translate([0, -3.6, 33]) scale([4, 1.6, 3]) sphere(1, $fn = 24);
  translate([0, -3.4, 27.6]) scale([1.2, 1, 1]) sphere(1, $fn = 16);
}
// Mask crest.
petal([1, 0.5, 1.6], [0, -4.6, 36], [0, 0, 0], [0.55, 0.3, 0.6]);
ell([2.8, 0.5, 0.45], [0, -5.1, 34.6], maskSh);
mirror_x() {
  color([0.1, 0.04, 0.12]) translate([1.8, -5, 32.7]) rotate([0, -22, 0]) scale([1.4, 0.5, 0.7]) sphere(1, $fn = 14);
  color(red) translate([1.8, -5.35, 32.7]) rotate([0, -22, 0]) scale([0.7, 0.4, 0.45]) sphere(1, $fn = 12);
}
// White collar of fur under the mask.
for (a = [-60 : 30 : 60]) petal([2.2, 1, 3], [5.5 * sin(a), -4 * cos(a), 27], [-20, 0, -a], smoke);

// Smoke curling off the head and shoulders, sweeping back to the viewer's right.
// Thick tapered smoke ribbons.
module curl(pts, rs, c) {
  chain(pts, [for (r = rs) max(r * 1.25, 1.1)], c);
}
// Big white smoke mane framing the mask.
blob([[[6.5, 4, 5], [0, 2, 36]], [[5, 4, 4], [3, 2.5, 39]]], smoke);
ell([4, 3, 3], [-3.5, 3, 39.5], smokeDk);
curl([[2, 2, 37], [6, 3, 40], [10, 5, 40], [12, 6, 37], [10.5, 6.5, 35]], [2.4, 2, 1.6, 1.1, 0.6], smoke);
curl([[4, 3, 31], [9, 5, 33], [13, 6, 34], [16, 7, 32], [15, 8, 29.5]], [2.4, 2, 1.6, 1.1, 0.6], cloakHi);
curl([[6, 4, 26], [11, 6, 27], [15, 7, 25], [17, 8, 21], [15.5, 8.5, 18.5]], [2.2, 1.9, 1.5, 1, 0.5], cloakDk);
curl([[-2, 2, 37], [-5, 4, 40], [-8, 6, 40.5], [-9, 7, 38]], [2, 1.6, 1.2, 0.6], smoke);
curl([[0, 4, 33], [-4, 7, 31], [-8, 9, 29], [-10, 9, 25], [-8.5, 9, 23]], [2.2, 1.8, 1.4, 1, 0.5], smokeDk);

// Sleeves: wide cuffs, clawed grey hands. The viewer's left hand holds the orb.
mirror_x() {
  limb([6, 0, 27], [11, -2, 21], 2.6, 2.4, cloak);
  ell([2.8, 2.6, 2], [11.6, -2.6, 20], smoke);
  ell([1.6, 1.4, 1.4], [12, -3.2, 18.4], claw);
}
for (t = [-40, 0, 40]) spike([12 + sin(t), -4, 17.6], [sin(t) * 0.6, -0.8, -1.6], 0.4, 0.05, claw);
for (t = [-40, 0, 40]) spike([-12 + sin(t), -4, 17.6], [sin(t) * 0.6, -0.8, -1.6], 0.4, 0.05, claw);
// Glowing orb.
ell([3.2, 3.2, 3.2], [-8, -7, 18], orb);
ell([1.8, 1.8, 1.8], [-8, -9, 18.4], orbCore);
// Orb glows on the back of the cloak too.
ell([2.4, 0.6, 2.4], [0, 8.9, 18], [0.5, 0.36, 0.72]);
