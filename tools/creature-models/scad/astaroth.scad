// Astaroth: a black wolf-faced demon knight, red glowing veins, steel pauldrons, bat wings, a rusted greatsword in one
// hand, a red katana in the other, a spade-tipped devil tail.
include <lib.scad>

black = [0.12, 0.11, 0.13];
dark = [0.2, 0.19, 0.22];
steel = [0.36, 0.36, 0.4];
steelHi = [0.5, 0.5, 0.55];
red = [0.9, 0.08, 0.08];
glow = [1, 0.3, 0.2];
wing = [0.6, 0.16, 0.17];
wingBone = [0.18, 0.08, 0.09];
rust = [0.42, 0.33, 0.29];
rustDark = [0.3, 0.22, 0.2];
blood = [0.4, 0.05, 0.06];
claw = [0.55, 0.12, 0.12];
horn = [0.1, 0.09, 0.1];

// Glowing vein stroke: a thin capsule chain.
module vein(pts, r = 0.35) { chain(pts, [for (p = pts) r], red); }

// Legs: digitigrade, armoured shins, red clawed feet.
mirror_x() {
  limb([4, 0, 15], [5.5, -1.5, 9], 3.2, 2.6, black);
  limb([5.5, -1.5, 9], [5.8, 1, 3], 2.4, 1.8, dark);
  ell([2.2, 1.6, 2.8], [5.6, -2.8, 9], steel);
  blob([[[2.2, 3.4, 1.2], [5.8, -1.5, 1.2]], [[1.6, 1.6, 1.2], [5.8, 1, 1.5]]], claw);
  for (a = [-25, 0, 25]) spike([5.8 + sin(a) * 1.4, -4.6, 0.8], [sin(a) * 0.5, -1.2, -0.3], 0.4, 0.05, black);
}

// Hips with a tattered loincloth.
ell([6, 4.5, 3.5], [0, 0, 15.5], black);
petal([3.5, 1, 5], [0, -3.6, 12.5], [8, 0, 0], dark);
vein([[-1, -4.6, 14], [0.5, -4.7, 12], [-0.5, -4.6, 10]]);

// Torso: broad chest, narrow waist.
blob([[[5, 4, 4], [0, 0, 18]], [[8, 5.5, 4.5], [0, 0, 24]]], black);
// Abs / chest plates.
mirror_x() ell([2.8, 1, 2], [2.4, -4.8, 25], dark);
for (z = [18.5, 20.5]) mirror_x() ell([1.4, 0.8, 0.9], [1.4, -4, z], dark);
// Glowing sigil on the chest and veins.
color(glow) translate([0, -5.5, 25.5]) rotate([90, 0, 0]) cylinder(h = 0.6, r = 1, center = true, $fn = 4);
vein([[0, -5.4, 27.5], [0, -5.5, 23.5]], 0.3);
vein([[-1.8, -5.4, 25.5], [1.8, -5.4, 25.5]], 0.3);
vein([[3.5, -4.4, 21.5], [5, -4.0, 19], [4, -4, 17]]);
vein([[-3.5, -4.4, 21.5], [-5, -4.0, 19], [-4, -4, 17]]);
// Back veins.
vein([[0, 5.6, 27], [0.6, 5.4, 23], [-0.5, 5, 19]]);
mirror_x() vein([[3, 5, 26], [4.5, 4.6, 22], [3.5, 4.2, 19]]);

// Spiked steel pauldrons.
mirror_x() {
  ell([4, 4, 3.4], [8.2, 0, 27], steel);
  ell([3, 3, 2], [8.4, -0.4, 28.6], steelHi);
  spike([8.6, 0, 29.5], [1.2, 0, 3], 0.9, 0.05, steel);
}

// Mane: shaggy black fur around the neck.
for (a = [0 : 40 : 359]) spike([0, 1.5, 29], [3.5 * cos(a), 3.5 * sin(a) + 1, 2.5], 2.4, 0.2, black);
ell([5.5, 5, 3.5], [0, 1, 30], black);

// Head: wolf skull with a long snout.
blob([[[4.2, 4, 3.8], [0, -1, 33]], [[2.2, 3, 2], [0, -5.6, 31.6]]], black);
ell([1, 0.8, 0.8], [0, -8.4, 32], [0.05, 0.05, 0.05]);
// Jaw with fangs.
ell([2, 2.6, 1], [0, -5, 29.9], dark);
mirror_x() spike([1.2, -6.8, 30.4], [0, 0, -1.4], 0.35, 0.05, [0.9, 0.9, 0.85]);
// Glowing red eyes and the red face marking.
mirror_x() {
  color(glow) translate([1.9, -5.0, 33.7]) rotate([0, 0, -25]) scale([1.4, 0.7, 0.75]) sphere(1, $fn = 14);
  color([1, 0.8, 0.6]) translate([1.9, -5.55, 33.7]) scale([0.45, 0.3, 0.4]) sphere(1, $fn = 10);
  vein([[2.6, -4.2, 34.6], [1.4, -3.8, 36.2], [0.5, -2.8, 37]], 0.3);
}
vein([[0, -5.8, 33.4], [0, -4.4, 35], [0, -2.5, 36.6]], 0.3);
// Ears and curled horns.
mirror_x() {
  spike([2.6, 0, 35.5], [1.2, 0.6, 3], 1.2, 0.1, black);
  chain([[3.2, -0.5, 35.5], [5, -0.5, 38], [5.6, -0.5, 41], [4.4, -0.8, 43]], [1.2, 1, 0.7, 0.2], horn);
}

// Arms: big, with steel bracers and red claws.
// Creature's right arm (viewer's left) holds the greatsword low and forward.
limb([-8, 0, 26], [-9.5, -2, 20], 2.6, 2.2, black);
limb([-9.5, -2, 20], [-9, -5, 15.5], 2.2, 2, black);
ell([2.4, 2.4, 2.4], [-9.3, -3.5, 17.8], steel);
ell([2, 2, 1.8], [-9, -5.5, 14.6], claw);
// Greatsword: rusted blade pointing down and out to the viewer's left.
module greatsword() {
  color(rustDark) translate([0, 0, -4]) cylinder(h = 4, r = 0.7, $fn = 10);
  color(rust) translate([0, 0, -4.5]) sphere(1, $fn = 10);
  color(rust) translate([-3.5, 0, 0]) rotate([0, 90, 0]) cylinder(h = 7, r = 0.6, $fn = 10);
  color(rust) translate([-2.2, -0.55, 0.6]) cube([4.4, 1.1, 15]);
  color(rust) translate([0, 0, 15.6]) scale([2.2, 0.55, 2]) rotate([0, 45, 0]) cube(1.4, center = true);
  color(rustDark) translate([-0.5, -0.6, 0.6]) cube([1, 1.2, 14.5]);
  color(blood) translate([1.6, -0.5, 6]) scale([1.2, 0.4, 2.2]) sphere(1, $fn = 12);
  color(blood) translate([-1.6, 0.5, 11]) scale([1, 0.4, 1.6]) sphere(1, $fn = 12);
}
translate([-9, -5.5, 14.6]) rotate(_dir_rot([-0.7, -0.35, -0.62])) rotate([0, 0, 30]) greatsword();
// Creature's left arm (viewer's right) holds a red katana pointed down and back.
limb([8, 0, 26], [9.5, -1, 20], 2.6, 2.2, black);
limb([9.5, -1, 20], [9, -3.5, 15.5], 2.2, 2, black);
ell([2.4, 2.4, 2.4], [9.3, -2.2, 17.8], steel);
ell([2, 2, 1.8], [9, -4, 14.6], claw);
vein([[10.5, -3.5, 19], [11, -2.5, 22], [10.4, -1.6, 24]]);
translate([9, -4, 14.6]) {
  limb([0, 0, 0], [-0.6, -1.2, 2.6], 0.5, 0.5, [0.15, 0.1, 0.1]);
  ell([1.2, 1.2, 0.3], [0, 0, -0.5], steelHi);
  limb([0, 0, -0.8], [5, -3, -12.5], 0.5, 0.2, red);
  limb([0, -0.2, -0.8], [4.9, -3.3, -12.4], 0.3, 0.1, [0.25, 0.04, 0.04]);
}

// Bat wings out of the upper back, up and outward.
module batwing() {
  translate([0, 0, 0]) scale([1.25, 1, 1.15]) translate([0, 0, -3]) _batwing();
}
module _batwing() {
  // Bones.
  chain([[3, 4, 28], [9, 6, 33], [15, 7, 36]], [0.9, 0.7, 0.5], wingBone);
  for (t = [[19, 7.5, 33], [20, 7.5, 27], [17, 7, 22]]) limb([15, 7, 36], t, 0.4, 0.15, wingBone);
  spike([15, 7, 36], [0.5, 0, 2], 0.5, 0.05, wingBone);
  // Membrane: hull of thin slabs between bones.
  color(wing) for (seg = [[[3, 4, 28], [15, 7, 36], [19, 7.5, 33]], [[3, 4, 28], [19, 7.5, 33], [20, 7.5, 27]],
                          [[3, 4, 28], [20, 7.5, 27], [17, 7, 22]], [[3, 4, 28], [17, 7, 22], [9, 6, 23]]])
    hull() for (p = seg) translate(p) sphere(0.3, $fn = 8);
}
mirror_x() batwing();

// Devil tail sweeping out to the viewer's right, a spade tip.
chain([[2, 4, 15], [6, 9, 11], [12, 10, 9], [16, 8, 12], [18, 6, 15]], [1.6, 1.3, 1.0, 0.8, 0.6], black);
vein([[6, 9, 12.2], [11, 10.2, 10]], 0.3);
color(black) translate([18.6, 5.5, 16.2]) rotate([10, 25, 0]) scale([1.6, 0.4, 2.2]) rotate([0, 45, 0]) cube(1.6, center = true);
