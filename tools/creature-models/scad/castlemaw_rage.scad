// Castlemaw (Rage): the same armoured badger boiling over. The cloak smoulders red-brown with embers, the chest skull
// and the cannon mouths glow red, the jaws gape, and flames lick off its head and arms.
include <lib.scad>

fur = [0.13, 0.11, 0.11];
furHi = [0.5, 0.18, 0.1];
cloak = [0.28, 0.12, 0.09];
cream = [0.88, 0.84, 0.72];
bone = [0.92, 0.72, 0.6];
boneDark = [0.6, 0.45, 0.38];
steel = [0.5, 0.32, 0.3];
steelDark = [0.26, 0.17, 0.17];
mask = [0.1, 0.1, 0.11];
eyeRed = [0.85, 0.08, 0.08];
mouth = [0.35, 0.08, 0.08];
claw = [0.92, 0.75, 0.62];
glow = [1, 0.25, 0.12];
glowHot = [1, 0.65, 0.3];
ember = [1, 0.45, 0.15];

module flame(p, d, r) {
  color(glow) hull() { translate(p) scale([1.3, 1.3, 1]) sphere(r * 1.3, $fn = 10); translate(p + d) sphere(0.12, $fn = 6); }
  color(glowHot) hull() { translate(p) sphere(r * 0.55, $fn = 8); translate(p + d * 0.6) sphere(0.1, $fn = 6); }
}
module tuft(p, d, r, c) {
  m = p + d * 0.55;
  color(c) let($fn = 10) {
    hull() { translate(p) sphere(r); translate(m) sphere(r * 0.6); }
    hull() { translate(m) sphere(r * 0.6); translate(m + d * 0.45) sphere(0.15); }
  }
}

// Body: a barrel chest leaning forward on stocky legs.
blob([[[10, 8, 8], [0, 1, 18]], [[8.5, 7, 6], [0, 0, 11]], [[8, 7, 6], [0, 2, 25]]], fur);
// Chest skull plate.
color(bone) translate([0, -6.6, 19.5]) scale([5, 2.2, 5.2]) sphere(1, $fn = 24);
color(bone) translate([0, -7.2, 15]) scale([3.2, 1.6, 2.4]) sphere(1, $fn = 20);
mirror_x() { ell([1.6, 0.8, 1.8], [2, -8.5, 20], glow); ell([0.8, 0.5, 0.9], [2, -9.1, 20], glowHot); }
ell([0.6, 0.6, 0.9], [0, -8.7, 17.5], mask);
for (x = [-2.1 : 1.4 : 2.1]) color(mask) translate([x, -8.4, 14.6]) cube([0.35, 0.8, 2.4], center = true);
// Bone belt.
for (a = [-150 : 20 : 150]) color(a % 40 == 10 ? bone : boneDark)
  translate([8.8 * sin(a), 1 - 7.6 * cos(a), 10.5]) rotate([0, 0, a]) scale([1, 0.7, 1.3]) sphere(1.3, $fn = 12);

// Legs: thick, short, bear feet with bone claws.
mirror_x() {
  ell([4.4, 4.6, 5], [5.5, 0.5, 6], fur);
  blob([[[3.6, 4.6, 1.8], [6, -2, 1.8]]], fur);
  for (a = [-28, 0, 28]) spike([6 + sin(a) * 1.9, -6.2, 1.2], [sin(a) * 0.6, -1.5, -0.6], 0.55, 0.05, claw);
}

// Shaggy cloak: draped over the back and shoulders down to the ground, ragged hem.
color(cloak) hull() {
  translate([0, 5, 27]) scale([10, 6, 5]) sphere(1, $fn = 24);
  translate([0, 9, 4]) scale([13, 6, 3]) sphere(1, $fn = 24);
}
// Cloak fronts hanging open at the sides of the chest.
mirror_x() blob([[[3, 3, 7], [8.5, -2.5, 20]], [[2.6, 2.6, 4], [9.5, -1.5, 9]]], cloak);
// Fur shag: tufts pointing down over the cloak.
for (i = [0 : 17]) {
  a = -90 + i * (180 / 17);
  r = 11.5 + (i % 3);
  tuft([r * sin(a) * 0.95, 6 + 4 * cos(a), 6 + (i % 4) * 5], [sin(a) * 1.5, 2, -6], 2.2, i % 2 ? furHi : cloak);
}
for (row = [0 : 3]) for (i = [0 : 7]) {
  x = -10.5 + i * 3 + (row % 2) * 1.5;
  z = 28 - row * 6.5;
  yb = 9 + row * 1.1 - abs(x) * 0.12;
  tuft([x, yb, z], [x * 0.08, 2.2, -8.5], 2.3, (i + row) % 3 == 0 ? furHi : cloak);
}
// Shag along the shoulders.
for (i = [0 : 8]) tuft([-10 + i * 2.5, 2 + (i % 2) * 2, 30.5], [(i - 4) * 0.5, 1.5, 3.5], 1.8, i % 2 ? cloak : furHi);
// Back spikes in bone.
for (s = [[0, 10, 28], [-5, 10.5, 23], [5, 10.5, 23], [-2.5, 12, 17], [3, 12, 17]]) spike(s, [0, 4, 3], 1.4, 0.1, bone);

// Arms: steel-banded, hanging forward, ending in cannon barrels with bone claws under them.
module arm(s) {
  // Shoulder pauldron with bone spikes.
  color(steel) translate([s * 11, 0, 26]) scale([4.4, 4.4, 3.6]) sphere(1, $fn = 20);
  spike([s * 12, -1, 28.5], [s * 1.5, 0, 4], 1.1, 0.1, bone);
  spike([s * 14, 0.5, 27], [s * 3, 0, 2.5], 1, 0.1, bone);
  spike([s * 12, 2, 29], [0, 1, 3.5], 0.9, 0.1, bone);
  // Upper arm in bands.
  for (i = [0 : 2]) color(i % 2 ? steelDark : steel)
    translate([s * (12.5 + i * 0.3), -1 - i * 1, 22 - i * 2.6]) scale([3.4, 3.4, 1.5]) sphere(1, $fn = 18);
  // Forearm cannon pointing forward-down.
  color(steelDark) translate([s * 13, -4, 14]) rotate([70, 0, 0]) cylinder(h = 8, r = 3.2, center = true, $fn = 20);
  for (k = [-2.5, 0, 2.5]) color(k == 0 ? bone : steel)
    translate([s * 13, -4 + k * 0.94, 14 - k * 0.34]) rotate([70, 0, 0]) cylinder(h = 1.2, r = 3.6, center = true, $fn = 20);
  color(steelDark) translate([s * 13, -8.2, 12.6]) rotate([70, 0, 0]) difference() {
    cylinder(h = 1.6, r = 2.6, center = true, $fn = 18);
    cylinder(h = 2, r = 1.6, center = true, $fn = 14);
  }
  color(glow) translate([s * 13, -8.2, 12.6]) rotate([70, 0, 0]) cylinder(h = 0.6, r = 1.7, $fn = 14);
  color(glowHot) translate([s * 13, -8.6, 12.5]) rotate([70, 0, 0]) cylinder(h = 0.4, r = 0.9, $fn = 12);
  for (f = [[0, 0, 7], [1.5, 0.5, 5], [-1.5, 0.5, 5]]) flame([s * 13 + f[0] * s, -4 + f[1], 17], [s * f[0] * 0.6, 0, f[2]], 1.4);
  // Claws peeking out below the barrel.
  for (a = [-25, 0, 25]) spike([s * 13 + sin(a) * 1.8, -6, 10.5], [sin(a) * 0.4, -0.6, -2.2], 0.5, 0.05, claw);
}
arm(1);
arm(-1);

// Head scaled up about the neck.
translate([0, -1, 28]) scale(1.35) translate([0, 0, -28]) {
// Head: badger, thrust forward and low, black with a cream stripe and cheeks, red eyes, snarling.
blob([[[5.5, 5, 4.6], [0, -2, 30]], [[3.4, 3.4, 2.8], [0, -7, 28.6]], [[2, 2.2, 1.7], [0, -10, 28.3]]], mask);
// Cream stripe over the crown, and cream cheeks.
color(cream) intersection() {
  blob([[[5.7, 5.2, 4.8], [0, -2, 30]], [[3.6, 3.6, 3], [0, -7, 28.6]], [[2.2, 2.4, 1.9], [0, -10, 28.3]]]);
  translate([0, -3, 33]) cube([3.2, 20, 6], center = true);
}
mirror_x() ell([2.2, 2.6, 2], [3.9, -4, 27.4], cream);
mirror_x() ell([1.6, 1, 1.2], [4.2, -1.2, 33.2], cream); // ears
ell([1.1, 0.9, 0.9], [0, -12, 28.6], mask);
ell([1.2, 0.9, 0.9], [0, -12.1, 28.8], [0.2, 0.2, 0.2]);
// Snarl: red mouth with bared bone fangs.
color(mouth) translate([0, -9.4, 26.2]) scale([2.4, 2, 1.6]) sphere(1, $fn = 16);
color(mask) translate([0, -8.6, 24.8]) scale([2.2, 2.6, 1]) sphere(1, $fn = 16);
for (x = [-1.6, -0.6, 0.6, 1.6]) spike([x, -10.4, 27.3], [0, 0, -1], 0.35, 0.05, claw);
for (x = [-1.2, 1.2]) spike([x, -10.4, 24.6], [0, 0, 1.1], 0.3, 0.05, claw);
// Angry red eyes under heavy brows.
mirror_x() {
  eye([2.1, -8, 30.1], 1.3, iris = eyeRed, pupil = [0.2, 0, 0], sclera = [0.95, 0.5, 0.45], yaw = -22);
  color(mask) translate([2.2, -8.3, 31.4]) rotate([0, -22, -22]) scale([1.6, 0.7, 0.5]) sphere(1, $fn = 12);
}
}

// Rage: embers glinting all over the cloak, flames off the brow and the back.
embers = [[-8, 11, 26], [6, 12, 22], [-3, 13, 15], [9, 11, 12], [-10, 10, 8], [2, 13.5, 9], [-6, 12.5, 19], [11, 9, 18],
          [-11, 8, 14], [4, 12, 28], [8, 2, 31], [-9, 2, 30], [12, -2, 8], [-12, -2, 6]];
for (e = embers) color(ember) translate(e) sphere(0.7, $fn = 8);
flame([3.5, -9, 34], [1.5, 2, 5], 1.2);
flame([-3.5, -9, 34], [-1.5, 2, 5], 1.2);
flame([-9, 9, 30], [-2, 1, 6], 1.6);
flame([9, 9, 30], [2, 1, 6], 1.6);
flame([0, 11, 31], [0, 2, 7], 1.8);
flame([-12, 10, 22], [-3, 1, 5], 1.4);
