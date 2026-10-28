// Briarvaunt: Nettlewisp grown into a great forest lion-stag. A sage-green mossy body laced with glowing cyan vein
// lines, a lilac-tinged shaggy mane, a bark breastplate set with cyan gems, wide antlers hung with glowing crystal
// fruit, glowing cyan eyes and a long curling vine tail.
include <lib.scad>

moss = [0.4, 0.58, 0.45];
mossLight = [0.55, 0.72, 0.52];
mossDark = [0.25, 0.4, 0.35];
slate = [0.38, 0.48, 0.55];
mane = [0.47, 0.6, 0.56];
maneLilac = [0.58, 0.58, 0.76];
bark = [0.45, 0.32, 0.22];
antler = [0.48, 0.42, 0.36];
cyan = [0.45, 0.95, 0.95];
lilac = [0.72, 0.6, 0.92];
blueOrb = [0.5, 0.75, 1];
leafC = [0.45, 0.7, 0.35];

module leaf(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) translate([0, 0, l / 2]) scale([w, w * 0.35, l / 2]) sphere(1, $fn = 10);
}
// Glowing vein line along a path.
module vein(pts) { chain(pts, [for (p = pts) 0.35], cyan); }

// Body: a heavy lion's torso.
blob([[[7, 8, 7], [0, -4, 17]], [[6, 7, 6], [0, 6, 16]]], moss);
ell([5.6, 10, 3], [0, 1, 11.5], slate);
// Vein lines over the flanks and back.
mirror_x() {
  vein([[6.6, -6, 18], [7, -1, 16], [6.4, 4, 18], [5.6, 9, 16]]);
  vein([[6, -2, 21], [5.2, 3, 21.5], [4.6, 8, 20]]);
}
vein([[0, 0, 23.6], [0, 6, 22]]);

// Legs: thick, the lower legs slate with cyan stripes; big paws.
module leg(x, y) {
  limb([x, y, 15], [x, y - 0.5, 6], 3.2, 2.6, moss);
  limb([x, y - 0.5, 6], [x, y - 0.8, 1.5], 2.6, 2.6, slate);
  ell([3, 3.6, 1.6], [x, y - 1.6, 1.6], slate);
  for (k = [-1, 0, 1]) color(mossLight) translate([x + k * 1.6, y - 4.8, 1.2]) scale([0.7, 0.7, 0.6]) sphere(1, $fn = 10);
  vein([[x + 2.4, y - 1.5, 9], [x + 2.6, y - 1, 5], [x + 2.4, y - 1.2, 2.5]]);
}
mirror_x() { leg(4.2, -7); leg(4.4, 9); }

// Mane: shaggy lilac-tinged tufts all round the neck and shoulders.
ell([7.6, 6.4, 6.6], [0, -6, 21.5], mane);
for (t = [0 : 1], a = [0 : 30 : 359]) {
  aa = a + t * 15;
  r = t == 0 ? 7.6 : 6;
  spike([r * cos(aa), -6 + r * 0.85 * sin(aa), t == 0 ? 20 : 25], [cos(aa) * 3, sin(aa) * 2.8 + 1, -4], 2, 0.1,
        (a / 30 + t) % 3 == 0 ? maneLilac : ((a / 30 + t) % 3 == 1 ? mane : mossDark));
}
for (x = [-4 : 2 : 4]) spike([x, -13, 20], [x * 0.2, -0.8, -5], 1.6, 0.1, x % 4 == 0 ? mane : mossDark);

// Bark breastplate with three cyan gems.
color(bark) translate([0, -13.2, 17.5]) rotate([12, 0, 0]) scale([4.2, 1.5, 4]) sphere(1, $fn = 6);
for (p = [[-2, -14.2, 18.5], [2, -14.2, 18.5], [0, -14.4, 16]]) color(cyan) translate(p) scale([0.9, 0.6, 1.2]) sphere(1, $fn = 8);

// Head: broad lion face with a short muzzle.
blob([[[6, 5.6, 5.6], [0, -13, 28]], [[3.8, 3.2, 3], [0, -17.5, 26.2]]], moss);
ell([3.4, 2.4, 2.2], [0, -18.6, 25], mossLight);
ell([1.1, 0.7, 0.8], [0, -20.8, 26.4], mossDark);
color(mossDark) translate([0, -20.6, 24.2]) scale([1.8, 0.4, 0.3]) sphere(1, $fn = 10);
// Glowing cyan eyes under heavy brows.
mirror_x() {
  color(cyan) translate([2.9, -17.9, 28.8]) rotate([0, 0, -22]) scale([1.5, 0.6, 0.9]) sphere(1, $fn = 14);
  color([0.9, 1, 1]) translate([2.8, -18.4, 29]) sphere(0.35, $fn = 8);
  color(mossDark) translate([3, -17.8, 30.1]) rotate([0, 12, -22]) scale([2, 0.8, 0.5]) sphere(1, $fn = 12);
}
// Lion's ruff framing the face.
for (a = [-30 : 30 : 210]) spike([5.2 * cos(a), -11, 27.5 + 5.6 * sin(a)], [cos(a) * 3.2, 1.2, sin(a) * 3.2 - 1], 1.6, 0.1, a % 60 == 0 ? mane : maneLilac);
// Small ears.
mirror_x() leaf([4.6, -10.5, 31], [1.8, 0.5, 2.4], 1.4, moss);
// Dark horn spike on the brow (seen on the sprite).
spike([0, -11, 32.5], [0, 1, 3.5], 1, 0.1, mossDark);

// Antlers: wide branching wood, crystal fruit and leaves.
module antlers() {
  chain([[2.6, -10, 32], [5, -9, 35.5], [8, -8, 38.5], [11, -7, 40]], [1, 0.85, 0.7, 0.45], antler);
  chain([[5, -9, 35.5], [5, -10, 39.5], [6, -11, 42]], [0.7, 0.55, 0.35], antler);
  chain([[8, -8, 38.5], [8.6, -7, 42], [8, -6, 44]], [0.6, 0.45, 0.3], antler);
  chain([[8, -8, 38.5], [11.5, -9.5, 37.5], [13.5, -9, 38.5]], [0.55, 0.45, 0.3], antler);
  limb([11, -7, 40], [12.5, -5.5, 42.5], 0.45, 0.3, antler);
  color(blueOrb) translate([6, -11, 42.6]) sphere(1.2, $fn = 12);
  color(lilac) translate([8, -6, 44.6]) sphere(1.1, $fn = 12);
  color(cyan) translate([13.8, -9, 39.6]) sphere(1, $fn = 12);
  color(lilac) translate([4.6, -9.8, 37]) sphere(0.8, $fn = 10);
  color(blueOrb) translate([12.6, -5.5, 43.4]) sphere(0.9, $fn = 10);
  leaf([10, -7.6, 39.5], [0.5, -1, 1.8], 0.8, leafC);
  leaf([6.8, -9, 37.5], [-0.5, -1, 1.8], 0.7, leafC);
}
mirror_x() antlers();

// Long vine tail curling up behind and to the viewer's right, a leafy tip.
chain([[2, 12, 18], [7, 16, 16], [13, 17, 18], [17, 15, 23], [17, 11, 27], [14, 9, 27]], [1.8, 1.6, 1.4, 1.2, 1, 0.8], mossDark);
vein([[7, 16, 17.6], [13, 17, 19.4], [17.6, 14.6, 24]]);
for (a = [0 : 60 : 300]) leaf([14, 9, 27], [cos(a) * 2.2, -0.5, sin(a) * 2.2 + 1], 1, a % 120 == 0 ? leafC : mossLight);

// Drifting spirit motes.
color(blueOrb) translate([-14, -8, 26]) sphere(0.9, $fn = 10);
color(lilac) translate([14, -4, 30]) sphere(0.8, $fn = 10);
color(cyan) translate([-13, 6, 14]) sphere(0.7, $fn = 10);
leaf([15, -10, 14], [1, 0, -1.5], 0.6, leafC);
