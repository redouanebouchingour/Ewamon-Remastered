// Murmink: a lanky charcoal imp with a white mask for a face, red eyes, pointed ears, a blue flame mane down its
// back and iridescent threads trailing from its clawed hands.
include <lib.scad>

skin = [0.22, 0.2, 0.27];
skinHi = [0.32, 0.3, 0.38];
mask = [0.93, 0.93, 0.95];
maskSh = [0.72, 0.72, 0.78];
red = [0.85, 0.1, 0.12];
flameDk = [0.12, 0.25, 0.7];
flame = [0.2, 0.5, 0.92];
flameHi = [0.35, 0.8, 0.95];
thread1 = [0.88, 0.8, 0.95];
thread2 = [0.75, 0.92, 0.9];
thread3 = [0.95, 0.88, 0.8];

// Slim torso, narrow waist, rounded hips.
blob([[[4.6, 3.6, 4.5], [0, 0, 22]], [[3.2, 2.8, 3], [0, 0, 17]], [[4.2, 3.4, 3], [0, 0.4, 13.5]]], skin);
ell([2.6, 1.4, 4], [0, -2.8, 20], skinHi);

// Head: small skull with a white mask on the front.
blob([[[5.4, 5, 5], [0, 0.6, 30]], [[3.4, 3.4, 3], [0, 0, 26.5]]], skin);
// Mask: a long pointed shield.
color(mask) hull() {
  translate([0, -4, 31]) scale([4.8, 1.8, 3.2]) sphere(1, $fn = 24);
  translate([0, -3.4, 25.8]) scale([1.4, 1, 1]) sphere(1, $fn = 16);
}
ell([3.2, 0.6, 0.5], [0, -4.85, 32.8], maskSh);
// Narrow red eyes, slanted.
mirror_x() {
  color([0.1, 0.05, 0.08]) translate([2, -5.4, 30.6]) rotate([0, -20, 0]) scale([1.4, 0.5, 0.75]) sphere(1, $fn = 14);
  color(red) translate([2, -5.75, 30.6]) rotate([0, -20, 0]) scale([0.8, 0.4, 0.55]) sphere(1, $fn = 12);
}
// Pointed ears with a dark inner side.
mirror_x() {
  spike([4.2, 0.4, 32], [3.4, 0, 5], 2, 0.15, skin);
  spike([4.5, 0, 32.2], [3, -0.3, 4.2], 1.1, 0.1, [0.12, 0.25, 0.7]);
}
// Neck ruff spikes.
mirror_x() for (a = [20, 60]) spike([3 * cos(a), 1, 25], [3 * cos(a), 1, -1.2], 1.1, 0.1, skin);

// Blue flame mane: a wavy crest off the top of the head and a flowing stream down the back.
chain([[0, 0, 32], [0.5, 0.5, 36], [-1.5, 2, 39], [0.5, 3.5, 42], [2.5, 4, 44]], [3.4, 2.8, 2.2, 1.5, 0.5], flameDk);
chain([[0, -0.6, 32.5], [0.3, -0.2, 36], [-1.2, 1.4, 38.5], [0.3, 2.6, 41]], [2.6, 2.1, 1.6, 0.6], flame);
chain([[0.2, -3.2, 33.6], [0.4, -2.4, 36], [-0.6, -0.6, 38]], [1.6, 1.1, 0.4], flameHi);
chain([[-1.5, -3.2, 33.8], [-2.5, -2.6, 35.5]], [1.2, 0.4], flame);
// Side wisp to the viewer's right.
chain([[3, 1, 30], [6, 1.5, 31], [7.5, 2, 33.5], [6.5, 2.5, 35.5]], [1.6, 1.3, 0.9, 0.4], flame);
// Back stream.
chain([[0, 3.5, 31], [1.5, 5.5, 27], [-1, 5.8, 22], [1.5, 6, 17], [-0.5, 6.2, 13], [2, 6.5, 9]], [3.4, 3, 2.8, 2.4, 2, 1], flameDk);
chain([[0, 4.5, 30], [1.2, 6.8, 26.5], [-0.8, 7.2, 21.5], [1.2, 7.2, 17]], [2.2, 2, 1.8, 1.2], flame);
chain([[0.5, 6.5, 28], [0.8, 8.4, 25], [-0.4, 8.4, 21]], [1, 0.9, 0.5], flameHi);

// Arms: thin, raised, with long hooked claws.
mirror_x() {
  chain([[4.4, 0, 23.5], [8.5, -0.5, 21], [11, -2.5, 25]], [1.4, 1.1, 0.9], skin);
  ell([1.5, 1.3, 1.3], [11.4, -3, 26], skin);
  for (a = [-40, -10, 20]) chain([[11.4 + sin(a) * 1.2, -4, 26.5], [11.8 + sin(a) * 2.2, -5.6, 27], [12 + sin(a) * 2.6, -6.4, 25.6]], [0.45, 0.35, 0.12], [0.1, 0.09, 0.12]);
  // Iridescent threads hanging from the claws.
  for (i = [0 : 4]) {
    x0 = 10.6 + i * 0.6;
    limb([x0, -5.8, 26], [x0 + 2.5 + i * 0.4, -5 + i * 0.4, 15 - i * 0.8], 0.16, 0.1, [thread1, thread2, thread3][i % 3]);
  }
  color([thread1, thread2, thread3][1]) hull() {
    translate([10.8, -5.6, 25]) sphere(0.1);
    translate([12.5, -5.2, 15]) sphere(0.1);
    translate([15, -3.6, 14]) sphere(0.1);
  }
}

// Legs: digitigrade, thin shins, long clawed feet.
mirror_x() {
  ell([2.5, 2.8, 3.6], [3, -0.4, 11], skin);
  chain([[3.4, -0.8, 9], [4.2, 0.8, 5], [4.6, -0.6, 1.4]], [1.8, 1.2, 1], skin);
  ell([1.3, 2.6, 0.9], [4.8, -2.4, 0.9], skin);
  for (a = [-25, 10]) spike([4.8 + sin(a), -4.6, 0.8], [sin(a) * 0.5, -1.4, -0.4], 0.4, 0.05, [0.1, 0.09, 0.12]);
}

// Tail curling out to the viewer's right.
chain([[1.5, 3, 13], [5, 6, 10], [9, 6.5, 8], [12, 5, 9.5], [13, 3.5, 12]], [1.4, 1.2, 1, 0.8, 0.4], skin);
