// Glimmereen: Glimp grown into a bubble fairy. A round pearly body that fades to periwinkle below, a pink bow with a
// single antenna topped by a gold bead, two pairs of translucent sky-blue sparkling wings, blushing cheeks, stubby arms
// and two little legs.
include <lib.scad>

pearl = [0.94, 0.95, 1];
peri = [0.78, 0.82, 1];
lilac = [0.88, 0.84, 1];
shine = [1, 1, 1];
blush = [1, 0.72, 0.78];
bow = [0.95, 0.6, 0.65];
bowDk = [0.82, 0.45, 0.52];
antenna = [0.7, 0.72, 0.95];
gold = [0.98, 0.8, 0.2];
wing = [0.78, 0.9, 1];
wingEdge = [0.96, 0.9, 1];
sparkle = [1, 1, 1];
eyeC = [0.3, 0.22, 0.55];

module tint(c, d = 0.08) {
  color(c) intersection() {
    translate([0, 0, 18]) scale([9.5 + d, 9 + d, 9 + d]) sphere(1, $fn = 40);
    children();
  }
}

// Body.
ell([9.5, 9, 9], [0, 0, 18], pearl);
tint(peri) translate([0, 0, 2]) scale([14, 14, 11]) sphere(1, $fn = 24);
tint(lilac, 0.12) translate([10, 4, 18]) scale([5, 6, 6]) sphere(1, $fn = 18);
tint(shine, 0.2) translate([-4.4, -6.6, 23.6]) scale([2, 2, 1.3]) sphere(1, $fn = 14);

// Face: big violet eyes, pink cheeks and a small smile.
mirror_x() {
  eye([3.2, -8.3, 18.8], 1.5, iris = eyeC, pupil = [0.15, 0.1, 0.35], sclera = eyeC, yaw = -20, flat = 0.5);
  tint(blush, 0.12) translate([5.2, -8, 16.4]) scale([1.6, 2, 1]) sphere(1, $fn = 14);
}
color(eyeC) translate([0, -8.95, 15.8]) rotate([90, 0, 0]) difference() {
  cylinder(h = 0.5, r = 1.2, center = true, $fn = 20);
  cylinder(h = 1, r = 0.8, center = true, $fn = 20);
  translate([0, 1.2, 0]) cube([3, 2.4, 2], center = true);
}

// Pink bow on top, a bit off to the viewer's left.
translate([-1.6, -1, 26.6]) rotate([0, -10, 0]) {
  mirror_x() color(bow) hull() {
    sphere(0.8, $fn = 10);
    translate([2.8, 0, 0.6]) scale([1.2, 0.9, 1.8]) sphere(1, $fn = 14);
  }
  ell([1, 1, 1], [0, 0, 0], bowDk);
  mirror_x() limb([0.5, 0, -0.4], [1.5, -0.4, -2], 0.5, 0.4, bowDk);
}
// Antenna rising from behind the bow with a gold bead.
chain([[0, 0, 26.4], [-1.4, -0.2, 30], [-3.2, -0.4, 33]], [0.4, 0.38, 0.35], antenna);
ell([1.5, 1.5, 1.5], [-3.6, -0.4, 34.2], gold);
ell([0.4, 0.3, 0.4], [-4.1, -1.7, 34.8], shine);

// Wings: two pairs of translucent-looking blue petals behind the body, with a few sparkles.
module wingPair(rot, len, wid, z) {
  mirror_x() translate([2, 6, z]) rotate([-30, 0, 0]) rotate([0, rot, 15]) {
    color(wingEdge) translate([0, 0, len]) scale([wid + 0.4, 0.3, len + 0.4]) sphere(1, $fn = 24);
    color(wing) translate([0, -0.12, len]) scale([wid, 0.3, len]) sphere(1, $fn = 24);
    color(wing) translate([0, 0.12, len]) scale([wid, 0.3, len]) sphere(1, $fn = 24);
    for (sp = [[0.3, 0.6], [-0.4, 1.2], [0.2, 1.6]]) for (y = [-0.45, 0.45])
      color(sparkle) translate([sp[0] * wid, y, sp[1] * len]) scale([0.5, 0.2, 0.5]) sphere(1, $fn = 6);
  }
}
wingPair(48, 10, 5.8, 21);
wingPair(120, 6.5, 4, 15);

// Stubby arms.
mirror_x() {
  limb([7.6, -1, 16.6], [10.6, -2.6, 15.2], 1.8, 1.5, pearl);
}
// Legs.
mirror_x() {
  limb([3.4, 0, 10], [3.6, -0.4, 2.2], 2.8, 2.5, peri);
  ell([2.7, 3.2, 1.8], [3.6, -0.8, 1.8], peri);
}
