// Nettlewisp: a small upright moss spirit with a pale-green cat face, branching brown antlers, a shaggy cloak of
// leaves and vines with glowing four-dot clover marks, dark mossy legs and a thin vine tail ending in a leaf tuft.
include <lib.scad>

moss = [0.2, 0.5, 0.2];
mossLight = [0.4, 0.68, 0.3];
mossDark = [0.1, 0.3, 0.14];
leafPale = [0.62, 0.82, 0.5];
face = [0.8, 0.92, 0.66];
faceShade = [0.55, 0.74, 0.45];
antler = [0.5, 0.36, 0.22];
vine = [0.4, 0.3, 0.18];
glow = [0.85, 1, 0.55];

// A leaf: flat ellipsoid pointing along d.
module leaf(p, d, w, c) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) translate([0, 0, l / 2]) scale([w, w * 0.35, l / 2]) sphere(1, $fn = 10);
}

// Body: a shaggy cone of moss.
blob([[[8, 7, 6], [0, 0, 11]], [[6, 5.5, 4.5], [0, 0, 15.5]], [[7.6, 6.6, 3], [0, 0, 6.5]]], moss);
// Shaggy leaf fringe hanging around the body in three tiers.
for (t = [0 : 2], a = [0 : 30 : 359]) {
  aa = a + t * 15;
  r = [7.4, 6.8, 5.6][t];
  z = [7, 11, 15.5][t];
  spike([r * cos(aa), r * 0.88 * sin(aa), z], [cos(aa) * 3, sin(aa) * 2.6, -4.5], 1.7, 0.1,
       (a / 30 + t) % 3 == 0 ? mossLight : ((a / 30 + t) % 3 == 1 ? moss : mossDark));
}
// Glowing clover marks: four dots each, on the chest and back.
module clover(p, n) {
  for (k = [0 : 3]) color(glow) translate(p + [cos(k * 90 + 45), 0, sin(k * 90 + 45)] * 0.9 + n * 0.1) scale([0.75, 0.4, 0.75]) sphere(1, $fn = 10);
}
clover([2.2, -7, 11.5], [0, -1, 0]);
clover([-2.4, 6.3, 14.5], [0, 1, 0]);
clover([2.4, 6.9, 10], [0, 1, 0]);

// Legs: dark mossy stumps.
mirror_x() {
  limb([3.4, 0, 5], [3.6, -0.5, 1.5], 2.7, 2.5, mossDark);
  ell([2.7, 3.3, 1.4], [3.6, -1.4, 1.4], mossDark);
  leaf([3.6, -4.4, 1.2], [0.4, -1.4, -0.3], 0.9, mossLight);
}

// Arms: thin dangling vines with leaves.
mirror_x() {
  chain([[5.5, -1, 15], [9, -2, 12], [10.5, -2.5, 8], [11.5, -2, 4]], [1, 0.8, 0.6, 0.4], moss);
  leaf([9, -2, 12], [2.5, -0.5, -1], 1.2, mossLight);
  leaf([10.5, -2.5, 8], [-2, -0.5, -2], 1, leafPale);
  leaf([11.5, -2, 4], [1, -0.5, -2.5], 1, mossLight);
}

// Head block, scaled up for chibi proportions.
translate([0, -1.5, 22]) scale(1.3) translate([0, 1.5, -26]) {
// Head: a round cat head, moss on top, pale face in front.
ell([7, 6, 6], [0, -1.5, 26], moss);
ell([6.2, 3.8, 4.9], [0, -4.4, 24.6], face);
ell([2.8, 1.8, 1.8], [0, -7.4, 23.4], face);
// Mossy fringe over the brow and cheeks.
for (a = [20 : 28 : 160]) leaf([6.4 * cos(a), -4, 25 + 4.6 * sin(a)], [cos(a) * 1.6, -1.2, sin(a) * 1.6 - 0.6], 1.4, a % 56 == 20 ? mossLight : moss);
mirror_x() leaf([6.4, -3.5, 22.5], [1.8, -0.6, -2.2], 1.3, moss);
// Eyes, nose, mouth.
mirror_x() eye([2.5, -7.4, 25.6], 1.5, iris = [0.25, 0.55, 0.3], pupil = [0.05, 0.15, 0.08], sclera = [0.9, 1, 0.85], yaw = -15, flat = 0.4);
ell([0.6, 0.4, 0.4], [0, -9.1, 24], [0.15, 0.25, 0.12]);
mirror_x() color([0.15, 0.25, 0.12]) translate([0.5, -8.9, 22.9]) rotate([0, 30, 0]) scale([0.7, 0.25, 0.2]) sphere(1, $fn = 8);

// Big cat ears with pale insides.
mirror_x() {
  color(moss) hull() {
    translate([4.4, -1, 30]) scale([1.4, 0.7, 1]) sphere(2.6);
    translate([6.6, -1.5, 35.5]) sphere(0.4);
  }
  color(faceShade) hull() {
    translate([4.5, -2.4, 30.5]) scale([0.8, 0.3, 0.8]) sphere(1.8);
    translate([6.3, -2, 34.5]) sphere(0.3);
  }
}

// Antlers: branching brown twigs.
mirror_x() {
  chain([[2.4, 0, 30.5], [3, 0.5, 33.5], [4.2, 1, 36.5], [5, 1.2, 39.5]], [1, 0.85, 0.7, 0.45], antler);
  limb([3, 0.5, 33.5], [1, 0.6, 36], 0.65, 0.4, antler);
  limb([4.2, 1, 36.5], [7, 1.2, 38.5], 0.6, 0.35, antler);
  limb([3.6, 0.8, 35], [6, 0.8, 34.5], 0.55, 0.3, antler);
  leaf([7, 1.2, 38.5], [1.2, 0, 1.6], 0.7, leafPale);
}

}

// Vine tail curling out to the viewer's right, ending in a pale leaf tuft.
chain([[2, 5, 7], [6, 8, 6], [10, 9, 8], [12, 8, 12], [13, 6, 17]], [1.2, 1, 0.9, 0.8, 0.7], vine);
for (a = [-40 : 20 : 40]) leaf([13, 6, 17], [sin(a) * 3, -0.5, 5 + cos(a)], 1.5, abs(a) == 20 ? mossLight : leafPale);

// Drifting leaves.
leaf([-10, -3, 30], [1, 0, 1.4], 0.7, leafPale);
leaf([10, -5, 28], [-1, 0, 1.2], 0.6, mossLight);
leaf([-12, 2, 18], [1.2, 0, -1], 0.6, mossLight);
leaf([14, 1, 22], [0.5, 0, 1.4], 0.6, leafPale);
