// Bloomsprite: a little flower fairy, a rosebud for a hat over dark bobbed hair, a dress of green leaves, four pink
// veined wings, a rose-topped twig wand in her right hand, bare legs.
include <lib.scad>

skin = [0.92, 0.72, 0.6];
skinDk = [0.78, 0.55, 0.45];
hair = [0.3, 0.27, 0.36];
rose = [0.86, 0.38, 0.45];
roseDk = [0.62, 0.18, 0.28];
roseLt = [0.96, 0.6, 0.62];
leaf = [0.32, 0.6, 0.28];
leafDk = [0.18, 0.42, 0.2];
belt = [0.25, 0.2, 0.28];
wing = [1, 0.84, 0.88];
wingVein = [0.82, 0.48, 0.55];
twig = [0.48, 0.32, 0.18];

// Legs (bare) and feet.
mirror_x() {
  limb([2, 0, 13], [3.2, -0.5, 1.5], 1.4, 1.0, skin);
  ell([1.1, 2, 0.8], [3.3, -1.2, 0.8], skin);
}

// Leaf dress: a ring of drooping leaves for the skirt, a leaf bodice.
blob([[[3.4, 2.6, 3], [0, 0, 18]], [[2.8, 2.2, 2], [0, 0, 22]]], leaf);
color(belt) translate([0, 0, 16]) scale([3.6, 2.8, 0.7]) sphere(1, $fn = 24);
for (a = [0 : 40 : 359]) {
  color(a % 80 == 0 ? leaf : leafDk) translate([0, 0, 15.5]) rotate([0, 0, a + 20]) translate([3.6, 0, -3.2]) rotate([0, -35, 0])
    scale([0.7, 2.4, 4.4]) sphere(1, $fn = 16);
}
// Leaf collar.
mirror_x() petal([3, 1.2, 1.5], [2.4, -0.5, 23.2], [0, -15, -20], leaf);
petal([2, 1, 2.4], [0, -2.2, 21.5], [0, 0, 0], leafDk);

// Arms.
limb([3.2, 0, 22.5], [6, -2.5, 18.5], 0.9, 0.8, skin);
ell([0.9, 0.9, 0.9], [6.2, -2.8, 18.2], skin);
limb([-3.2, 0, 22.5], [-5, -2, 18], 0.9, 0.8, skin);
ell([0.9, 0.9, 0.9], [-5.2, -2.3, 17.6], skin);

// Wand: a twig with a pink rose on top, held in the right hand (viewer's left).
limb([-5.6, -2.6, 13], [-7.8, -3.5, 27], 0.4, 0.4, twig);
petal([1.4, 0.4, 0.7], [-6.8, -3.4, 25], [0, 30, 30], leaf);
translate([-7.9, -3.6, 28.6]) {
  color(roseLt) scale([2, 2, 1.6]) sphere(1, $fn = 20);
  color(rose) for (a = [0 : 72 : 359]) rotate([0, 0, a]) translate([1.2, 0, 0.6]) rotate([0, -40, 0]) scale([1.1, 0.5, 0.9]) sphere(1, $fn = 12);
  color(roseDk) translate([0, 0, 1.4]) sphere(0.7, $fn = 12);
}

// Head.
ell([4.2, 4, 4.2], [0, -0.3, 28], skin);
// Hair: dark bob around and behind the head, fringe across the brow.
color(hair) difference() {
  translate([0, 0.5, 28.8]) scale([4.8, 4.6, 4.8]) sphere(1, $fn = 28);
  translate([-6, -10, 20]) cube([12, 9, 9.6]);
}
mirror_x() ell([1.4, 1.2, 2.8], [3.6, -1.2, 26.8], hair);
// Pointed ears.
mirror_x() spike([4.2, 0, 27.5], [2.2, 0.4, 0.8], 0.7, 0.1, skin);
// Face.
mirror_x() eye([1.6, -3.7, 27.6], 1.05, iris = [0.32, 0.26, 0.4], pupil = [0.12, 0.08, 0.16], yaw = -14);
mirror_x() ell([0.7, 0.3, 0.4], [2.6, -3.5, 26], [0.95, 0.6, 0.6]);
color(roseDk) translate([0, -4.1, 25.6]) scale([0.9, 0.3, 0.25]) sphere(1, $fn = 12);

// Rosebud hat with green sepals.
translate([0, 0.5, 33]) {
  mirror_x() for (a = [-30, 30]) rotate([0, 0, a]) petal([2.4, 0.8, 1.2], [2.6, 0, 0], [0, -30, 0], leaf);
  petal([1, 2.2, 0.8], [0, -3, 0.2], [20, 0, 0], leaf);
  petal([1, 2.2, 0.8], [0, 3, 0.2], [-20, 0, 0], leaf);
  color(roseDk) translate([0, 0, 3.6]) scale([3.6, 3.4, 4]) sphere(1, $fn = 28);
  color(rose) for (a = [0 : 90 : 359]) rotate([0, 0, a + 45]) translate([1.8, 0, 3.8]) scale([1.8, 2.4, 3.6]) sphere(1, $fn = 20);
  color(roseLt) translate([0, -0.4, 6.2]) scale([2, 1.8, 1.8]) sphere(1, $fn = 18);
  color(roseDk) translate([0, -0.6, 7.6]) scale([0.9, 0.8, 0.7]) sphere(1, $fn = 12);
}

// Wings: two pairs of pink veined petals behind the shoulders, spread wide.
module wing(p, rot, r) {
  translate(p) rotate(rot) {
    color(wing) scale(r) sphere(1, $fn = 24);
    color(wingVein) for (t = [-0.5, 0, 0.5]) translate([0, 0, t * r[2] * 0.5]) scale([r[0] * 0.9, r[1] + 0.06, 0.12]) sphere(1, $fn = 12);
    color(roseLt) translate([0, 0, 0]) scale([r[0] + 0.15, r[1] * 0.3, r[2] + 0.15]) sphere(1, $fn = 24);
  }
}
mirror_x() {
  wing([8, 3.5, 29], [10, -50, 22], [11, 0.9, 4.2]);
  wing([7, 3.2, 19], [-10, 25, 22], [8, 0.8, 3.2]);
}
