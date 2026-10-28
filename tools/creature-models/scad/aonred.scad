// Aonred: an armoured shadow lord floating above the ground: a silver crested helm with red eyes,
// a pale ruff, black wings wreathed in blue flame, a blue fire phoenix rising from its crown and a glowing blue orb
// held in each claw; a blue gem on its back.
include <lib.scad>
// ground: -1.17   (it floats: the ground where its old fire pool stood, so it hovers as high as before)

shade = [0.13, 0.13, 0.16];
shadeHi = [0.25, 0.26, 0.3];
silver = [0.66, 0.7, 0.76];
silverHi = [0.86, 0.9, 0.95];
ruff = [0.8, 0.86, 0.92];
flameDk = [0.08, 0.22, 0.7];
flame = [0.2, 0.5, 0.95];
flameHi = [0.5, 0.8, 1];
orbCore = [0.1, 0.2, 0.75];
eyeRed = [0.9, 0.12, 0.1];

module fire(p, s = 1, lean = 1) {
  $fs = 1.1; $fa = 12;
  chain([p, p + [0.8 * lean, 0, 2.6] * s, p + [-0.6 * lean, 0, 4.6] * s, p + [1 * lean, 0, 6.8] * s], [2, 1.5, 0.9, 0.2] * s, flame);
  chain([p + [0, -0.9, 0] * s, p + [0.6 * lean, -1.1, 2] * s, p + [-0.3 * lean, -0.9, 3.6] * s], [1.2, 0.9, 0.2] * s, flameHi);
}


// Jagged black skirt with silver trim.
blob([[[5, 4.2, 3], [0, 0, 18]], [[7.5, 6.5, 2], [0, 0, 12]]], shade);
color(silver) translate([0, 0, 12.4]) rotate_extrude($fn = 32) translate([7.4, 0]) circle(0.5, $fn = 8);
for (a = [0 : 30 : 359]) spike([7.2 * sin(a), -6.2 * cos(a), 12], [2.6 * sin(a), -2.2 * cos(a), -4 - (a / 30 % 2) * 1.5], 1.6, 0.15, shade);
// Torso: armoured chest with silver plates.
blob([[[5.6, 4.4, 4], [0, 0, 22.5]], [[4, 3.4, 3], [0, 0, 18]]], shade);
mirror_x() color(silver) translate([2.2, -3.9, 21.5]) rotate([10, 0, 15]) scale([2, 0.6, 2.6]) sphere(1, $fn = 16);

// Pale ruff collar framing the helm, lower half dominant.
color(ruff) translate([0, -1.6, 26.5]) rotate([75, 0, 0]) rotate_extrude($fn = 32) translate([5.2, 0]) scale([1, 1.3]) circle(2, $fn = 14);
for (a = [200 : 20 : 340]) color(shadeHi) translate([0, -1.6, 26.5] + [5.6 * cos(a), -3 + sin(a), 5.4 * sin(a)]) rotate([0, 90 - a, 0]) cube([0.35, 0.35, 2.4], center = true);

// Helm: black head under a silver crested mask, red eyes.
blob([[[4, 3.8, 4.2], [0, -0.8, 28]], [[2.6, 2.6, 2.4], [0, 1.4, 31.5]]], shade);
color(silver) hull() {
  translate([0, -3.8, 29.5]) scale([4, 1.8, 3]) sphere(1, $fn = 20);
  translate([0, -4, 25.4]) scale([1.4, 1, 1]) sphere(1, $fn = 12);
}
ell([0.6, 0.6, 2.8], [0, -5.4, 30.4], silverHi);
mirror_x() ell([1.8, 0.4, 0.35], [1.8, -5.5, 30.6], shadeHi);
mirror_x() {
  spike([1.6, -3.6, 31.4], [2.2, 0.8, 3.2], 0.9, 0.1, silverHi);
  color([0.1, 0.04, 0.06]) translate([1.7, -5.1, 29.2]) rotate([0, -22, 0]) scale([1.3, 0.5, 0.65]) sphere(1, $fn = 14);
  color(eyeRed) translate([1.7, -5.45, 29.2]) rotate([0, -22, 0]) scale([0.7, 0.4, 0.45]) sphere(1, $fn = 12);
}

// Blue fire phoenix rising from the crown: neck, beaked head, flame crest.
chain([[0, 0.5, 32], [0.5, 0, 35], [-0.5, -0.5, 38], [0, -1.2, 40]], [2.2, 2, 1.7, 1.5], flame);
ell([2.4, 2.8, 2.1], [0, -2.2, 40.5], flame);
ell([1.2, 1.4, 1.1], [0, -3.4, 40], flameHi);
spike([0, -4.6, 40.3], [0, -2.2, -1.2], 0.9, 0.1, silverHi);
mirror_x() ell([0.35, 0.3, 0.35], [1.2, -4, 41.1], [0.05, 0.1, 0.4]);
for (i = [0 : 3]) chain([[0, -1.2 + i * 0.9, 41.5], [(i % 2 == 0 ? 1 : -1) * 1.2, i * 1.2 + 0.5, 44 + i * 0.3], [0, i * 1.6 + 1.5, 46 - i * 0.6]], [1.1, 0.7, 0.15], i % 2 == 0 ? flameHi : flame);
mirror_x() chain([[1.5, 0.5, 35], [4, 1.5, 37], [5.5, 2.5, 40], [5, 3, 42.5]], [1.4, 1.2, 0.8, 0.2], flame);

// Wings: big black feathers fanning up and out from the shoulder blades, blue fire licking off their tips.
mirror_x() {
  ell([2.4, 1.6, 2.4], [5.5, 3, 27], shade);
  for (i = [0 : 4]) {
    a = 26 + i * 16;
    l = 12 - abs(i - 2) * 1.2;
    petal([1.7, 0.55, l / 2], [5.5, 3.4 + i * 0.2, 27] + [sin(a), 0, cos(a)] * (l / 2 + 1), [0, a, 0], i % 2 == 0 ? shade : shadeHi);
    fire([5.5, 3.2, 27] + [sin(a), 0, cos(a)] * (l + 0.5), 0.55, 1);
  }
  ell([1.5, 0.8, 2], [9, 2.4, 31], flame);
  ell([0.8, 0.5, 1.1], [9, 1.7, 31], flameHi);
}

// Arms: silver-banded black arms, claws round glowing blue orbs.
mirror_x() {
  chain([[6, 0, 23.5], [10, -1, 19], [12, -3, 15]], [1.5, 1.3, 1.1], shade);
  color(silver) translate([10.2, -1.1, 19]) rotate([0, 50, 0]) rotate_extrude($fn = 16) translate([1.35, 0]) circle(0.35, $fn = 6);
  ell([3, 3, 3], [12.6, -4.6, 13], flame);
  ell([1.6, 1.4, 1.6], [12.6, -6.9, 13.2], orbCore);
  ell([0.7, 0.4, 0.7], [12.3, -7.9, 13.8], flameHi);
  for (t = [-50, 0, 50]) chain([[12 + sin(t) * 1.4, -3.4, 15.8], [12.6 + sin(t) * 3, -4.5, 15.6], [12.8 + sin(t) * 3.2, -6.5, 15]], [0.55, 0.45, 0.15], shadeHi);
}

// Back: blue gem in a silver setting, and a black tail curling round the column.
color(silver) translate([0, 4.2, 23]) rotate([-90, 0, 0]) cylinder(h = 0.8, r = 2.2, $fn = 20);
ell([1.5, 1, 1.5], [0, 5, 23], flame);
ell([0.6, 0.4, 0.6], [-0.4, 5.9, 23.5], flameHi);
chain([[0, 3.5, 15], [-4, 7, 13], [-9, 8, 14], [-12, 6, 16]], [2, 1.6, 1.1, 0.3], shade);
