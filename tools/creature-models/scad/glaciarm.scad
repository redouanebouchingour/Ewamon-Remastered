// Glaciarm: Coldplate grown into a steel-blue armoured knight with bronze trim, a crested helmet with glowing eyes
// behind a T visor, ice-crystal clusters on its shoulders and knees, and two huge fists of solid ice.
include <lib.scad>

steel = [0.36, 0.45, 0.6];
steelLight = [0.5, 0.6, 0.74];
steelDark = [0.24, 0.3, 0.42];
bronze = [0.72, 0.55, 0.32];
bronzeDark = [0.52, 0.38, 0.22];
ice = [0.6, 0.82, 1];
iceLight = [0.82, 0.94, 1];
iceDark = [0.4, 0.62, 0.9];
slit = [0.06, 0.08, 0.14];
glow = [0.6, 0.95, 1];

module crystal(p, d, r, c = ice) {
  l = norm(d);
  color(c) translate(p) rotate(_dir_rot(d)) {
    cylinder(h = l * 0.7, r = r, $fn = 6);
    translate([0, 0, l * 0.7]) cylinder(h = l * 0.3, r1 = r, r2 = 0, $fn = 6);
  }
}
module cluster(p, s = 1) {
  crystal(p, [0, 0, 7] * s, 1.3 * s, iceLight);
  crystal(p + [1.2, 0.5, 0] * s, [2.5, 0.5, 5.5] * s, 1.1 * s, ice);
  crystal(p + [-1, -0.5, 0] * s, [-2, -1, 5] * s, 1 * s, ice);
  crystal(p + [0.5, -1, 0] * s, [1, -2.5, 4] * s, 0.9 * s, iceDark);
  crystal(p + [-0.4, 1.2, 0] * s, [-0.5, 2.5, 4.5] * s, 0.9 * s, iceLight);
}

// Torso: broad chest tapering to the waist; bronze collar and centre seam; plated abdomen.
blob([[[10, 7, 6], [0, 0, 27]], [[6.5, 5.5, 4], [0, 0, 19.5]]], steel);
ell([7.5, 2, 4.2], [0, -5.6, 27.5], steelLight);
color(bronze) translate([0, -6.4, 24]) scale([0.7, 1, 6]) sphere(1, $fn = 12);
color(bronze) translate([0, 6.4, 25]) scale([0.7, 1, 7]) sphere(1, $fn = 12);
for (z = [17.8, 20]) ell([6.6 - (20 - z) * 0.3, 5.4, 1.1], [0, 0, z], z == 20 ? steelDark : steel);
// Belt and hanging fauld plate.
ell([7.2, 6, 1.4], [0, 0, 16.3], bronzeDark);
color(steel) hull() {
  translate([0, -5.4, 15.4]) scale([4.2, 0.9, 0.6]) sphere(1, $fn = 14);
  translate([0, -5.2, 10.5]) scale([2.4, 0.9, 0.6]) sphere(1, $fn = 14);
}
color(bronze) translate([0, -5.9, 13]) scale([2.6, 0.5, 2.6]) sphere(1, $fn = 4);

// Helmet: tall steel dome with a bronze crest ridge, dark T visor and glowing eyes.
H = [0, -1.5, 36];
blob([[[4.6, 5, 4.2], H], [[4.2, 4.4, 3.2], H + [0, -0.6, -2.6]]], steel);
color(bronze) translate(H + [0, 0, 0.2]) scale([0.9, 5.4, 4.6]) sphere(1, $fn = 20);
color(slit) translate(H + [0, -4.6, -0.6]) cube([7, 1.6, 1.8], center = true);
color(slit) translate(H + [0, -4.6, -2.6]) cube([1.8, 1.4, 3.6], center = true);
mirror_x() color(glow) translate(H + [1.6, -5.4, -0.6]) scale([0.9, 0.4, 0.55]) sphere(1, $fn = 10);
ell([5, 4.8, 1], H + [0, 0.2, -5], bronzeDark);

// Shoulders: domed pauldrons with bronze rims and a burst of ice crystals.
mirror_x() {
  ell([6.4, 6.4, 4.6], [11, 0, 31], steel);
  ell([6.8, 6.8, 1.2], [11, 0, 28.6], bronze);
  cluster([11, 0.5, 33.2], 1.6);
}

// Arms: steel upper arm and bracer, ending in a huge faceted ice fist held forward.
mirror_x() {
  limb([11.5, 0, 28], [13.5, -1, 22], 2.6, 2.4, steelDark);
  limb([13.5, -1, 22], [15.5, -4, 19], 2.6, 3.2, steel);
  ell([3.4, 3.4, 1], [15.5, -4.2, 19.6], bronze);
  // Ice fist: a chunky block with knuckles and a thumb.
  translate([17.5, -7, 18]) scale(1.5) {
    color(ice) hull() {
      translate([0, 0, 0]) scale([4.6, 4.6, 4.4]) sphere(1, $fn = 8);
      translate([0, -1.6, -1]) scale([4, 4, 3.8]) sphere(1, $fn = 8);
    }
    for (k = [-2.4, -0.8, 0.8, 2.4]) color(iceLight) translate([k, -4.8, 1.4]) scale([1, 1.2, 1.4]) sphere(1, $fn = 8);
    color(iceLight) translate([-3, -3, -1.6]) rotate([0, 30, 0]) scale([1.2, 2, 1.2]) sphere(1, $fn = 8);
    color(iceDark) translate([4.2, 0, 0]) scale([0.8, 3, 3]) sphere(1, $fn = 6);
  }
  // Frost swirl shards.
  for (a = [0 : 60 : 300]) color(iceLight) translate([17.5, -7, 18] + [10 * cos(a), 1.5 * sin(a * 2), 9 * sin(a)])
    rotate([0, a, 0]) scale([0.4, 0.4, 1.4]) sphere(1, $fn = 6);
}

// Legs: armoured thighs, knee cops with ice, greaves and heavy sabatons.
mirror_x() {
  limb([4, 0, 15], [5.5, -0.5, 9], 3.2, 2.9, steel);
  ell([3, 3.1, 1], [5.5, -0.5, 9.6], bronze);
  ell([2.4, 1.8, 2.4], [5.6, -3, 8.5], steelLight);
  cluster([6.6, -2.4, 9.5], 0.65);
  limb([5.5, -0.5, 8.5], [6, -0.5, 3], 3, 3.2, steel);
  ell([3.5, 3.6, 0.9], [6, -0.5, 4], bronze);
  blob([[[3.6, 5.4, 1.8], [6.2, -2, 1.8]], [[3, 3, 2], [6.2, 0.5, 2.4]]], steelDark);
}
