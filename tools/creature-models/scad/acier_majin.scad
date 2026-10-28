// Acier, Majin form: the four-armed brawler turned to black volcanic plate laced with glowing red cracks, bronze
// legs, bone spikes on shoulders and forearms, a forked bronze crest, a red ring-core in the chest, jagged black-red
// serrated blades, a red chain wrapped round the lower blade, and the serrated greatsword on its back.
include <lib.scad>

steel = [0.22, 0.2, 0.22];
steelDk = [0.24, 0.22, 0.23];
black = [0.1, 0.09, 0.1];
gold = [0.48, 0.38, 0.2];
goldDk = [0.33, 0.25, 0.12];
claw = [0.7, 0.7, 0.72];
blade = [0.85, 0.12, 0.1];
bladeDk = [0.12, 0.05, 0.05];
crack = [0.95, 0.12, 0.08];
horn = [0.62, 0.55, 0.42];
grip = [0.15, 0.14, 0.13];

// Sword: grip from the hand at p along unit-ish direction d, then a crossguard and blade of length l, width w.
module sword(p, d, l, w, gripL = 3) {
  translate(p) rotate(_dir_rot(d)) rotate([0, 0, -_dir_rot(d)[2]]) {
    color(grip) translate([0, 0, -gripL * 0.5]) cylinder(h = gripL, r = 0.45, center = true, $fn = 10);
    color(gold) translate([0, 0, gripL * 0.5]) cube([w * 1.7, 1, 0.6], center = true);
    color(blade) hull() {
      translate([0, 0, gripL * 0.5 + 0.3]) cube([w, 0.5, 0.1], center = true);
      translate([0, 0, gripL * 0.5 + l - w * 0.6]) cube([w, 0.5, 0.1], center = true);
      translate([w * 0.4, 0, gripL * 0.5 + l]) cube([0.2, 0.4, 0.1], center = true);
    }
    color(bladeDk) translate([w * 0.1, 0, gripL * 0.5 + l * 0.5]) cube([w * 0.25, 0.6, l * 0.8], center = true);
    // Serrated teeth along the back edge.
    color(blade) for (t = [0.15 : 0.14 : 0.85]) translate([-w * 0.5, 0, gripL * 0.5 + l * t])
      rotate([90, 0, 0]) linear_extrude(0.45, center = true) polygon([[0, 0], [0, w * 0.5], [-w * 0.45, w * 0.7]]);
  }
}

// Torso: broad chest tapering to the waist, pecs and abs.
blob([[[8, 5.5, 5], [0, 0, 24]], [[5, 4, 4], [0, 0, 17]]], steel);
mirror_x() ell([3.6, 2, 2.8], [2.6, -3.9, 24.5], steel);
color(black) translate([0, -4.5, 21]) scale([5.5, 1.5, 0.8]) sphere(1, $fn = 20);
for (z = [17, 19]) mirror_x() ell([1.4, 1, 0.9], [1.3, -3.6, z], steelDk);
// Belt and loincloth.
color(black) translate([0, 0, 14.6]) scale([5.4, 4.4, 1.3]) sphere(1, $fn = 24);
color(gold) translate([0, -4.3, 14.6]) scale([1.4, 0.6, 1]) sphere(1, $fn = 12);
color(steelDk) translate([0, -3.5, 12]) scale([2.6, 1, 2.6]) sphere(1, $fn = 14);

// Head: black helm with a gold crest fin and gold visor trim.
blob([[[3.6, 3.6, 3.8], [0, -0.5, 31]], [[2.6, 2.6, 2], [0, -1.5, 28]]], black);
mirror_x() chain([[0.8, -2.5, 33.5], [2.2, -2.2, 36], [3.6, -1.5, 38.5]], [0.9, 0.6, 0.1], gold);
color(gold) hull() {
  translate([0, -3, 33]) sphere(0.6, $fn = 10);
  translate([0, 1, 35.5]) sphere(0.4, $fn = 10);
  translate([0, 2.5, 33]) sphere(0.6, $fn = 10);
}
mirror_x() color(gold) translate([1.4, -3.5, 30.2]) rotate([0, 25, 0]) scale([0.5, 0.6, 2.6]) sphere(1, $fn = 10);
color(gold) translate([0, -3.6, 28]) scale([1.6, 0.6, 0.6]) sphere(1, $fn = 10);
mirror_x() color(crack) translate([0.9, -3.6, 31.2]) scale([0.7, 0.3, 0.35]) sphere(1, $fn = 10);
// Shoulder pads.
mirror_x() ell([3.4, 3.4, 2.6], [7, 0, 26.5], steel);

// Upper arms: raised, fists overhead holding swords.
mirror_x() {
  limb([7.5, 0, 26.5], [11, -1, 30], 2.9, 2.6, steel);
  ell([3, 3, 3], [11, -1, 30], steelDk);
  limb([11, -1, 30], [9.5, -2, 35], 2.5, 2.3, steel);
  ell([2.5, 2.5, 2.5], [9.5, -2.5, 35.5], steel);
}
// Lower arms: from under the chest, out and down to fists at hip height.
mirror_x() {
  limb([5.5, 0.5, 21], [10, 0, 19], 2.6, 2.4, steel);
  ell([2.8, 2.8, 2.8], [10.5, 0, 18.5], steelDk);
  limb([10.5, 0, 18.5], [11, -2.5, 13], 2.3, 2.2, steel);
  ell([2.4, 2.4, 2.4], [11, -3, 12.5], steel);
}

// Swords in the raised hands, crossing above the head; a broad cleaver in the lower right hand (viewer's left).
sword([-9.5, -2.5, 35.5], [0.6, 0.15, 1], 17, 2.4);
sword([9.5, -2.5, 35.5], [0.5, 0.3, 1], 17, 2.4);
sword([-11, -3, 12.5], [-0.12, -0.1, 1], 19, 4.4, 2.5);

// Greatsword slung diagonally across the back.
sword([5, 5.2, 14], [-0.35, 0.02, 1], 22, 3, 4);
color(black) translate([0, 5, 22]) rotate([0, 20, 0]) cube([1.2, 0.6, 14], center = true);

// Legs: gold-armoured thighs and shins, black knees and boots, white claws.
mirror_x() {
  ell([2.8, 2.8, 3.2], [3.6, 0, 11], gold);
  ell([1.8, 1.8, 1.4], [4.4, -1, 8], black);
  limb([4.4, -0.5, 7.5], [5, 0, 3], 2.2, 2.3, gold);
  color(goldDk) translate([4.8, -0.3, 5.5]) scale([2.4, 2.4, 0.5]) sphere(1, $fn = 16);
  blob([[[2.6, 3.4, 1.5], [5, -1.2, 1.5]], [[2.2, 2, 1.4], [5, 1, 1.5]]], black);
  for (a = [-28, 0, 28]) spike([5 + sin(a) * 1.4, -4.4, 1.0], [sin(a) * 0.5, -1.4, -0.4], 0.5, 0.05, claw);
}

// Glowing chest core: a red ring in the sternum.
color(bladeDk) translate([0, -4.9, 23.5]) scale([2.2, 1.2, 2.4]) sphere(1, $fn = 20);
color(crack) translate([0, -6, 23.5]) rotate([90, 0, 0]) scale([1, 1.15, 1]) rotate_extrude($fn = 24) translate([1.3, 0]) circle(0.4, $fn = 8);
mirror_x() color(crack) translate([4.5, -4.8, 24]) rotate([0, 30, 0]) scale([2.4, 0.5, 0.25]) sphere(1, $fn = 10);

// Red crack lines: thin glowing bands around the limbs and across the torso.
module band(p, d, r) { color(crack) translate(p) rotate(_dir_rot(d)) scale([1, 1, 0.12]) sphere(r, $fn = 18); }
mirror_x() {
  band([9.3, -0.5, 28.3], [1, 0.3, 1], 2.75);
  band([10.2, -1.5, 32.8], [-0.4, -0.2, 1], 2.45);
  band([8, 0.3, 20], [1, 0, -0.4], 2.55);
  band([10.8, -1.6, 15.8], [0.1, -0.5, -1], 2.3);
  band([3.6, 0, 11.5], [0, 0, 1], 2.85);
  band([4.8, -0.3, 4.5], [0, 0, 1], 2.35);
}
for (z = [18.5, 26.5]) band([0, 0, z], [0, 0, 1], z > 20 ? 7.3 : 4.8);

// Bone spikes on shoulders, elbows and forearms.
mirror_x() {
  spike([8, 0, 28.6], [0.6, 0.3, 2.6], 0.9, 0.08, horn);
  spike([12.6, -0.5, 31.6], [1.8, 0.4, 1.2], 0.8, 0.08, horn);
  spike([12.8, 0, 19.5], [1.8, 0.4, 0.5], 0.8, 0.08, horn);
  spike([13.2, -3, 13], [1.6, -0.2, -0.3], 0.7, 0.08, horn);
  spike([6.3, 1, 11], [1.4, 0.6, 0.6], 0.6, 0.06, horn);
}

// Red chain hanging off the lower blade's hilt.
color(crack) for (i = [0 : 9]) translate([-14.6 - 1.2 * sin(i * 30), -4.5, 12 + i * 1.3])
  rotate([0, 0, i % 2 == 0 ? 0 : 90]) rotate([90, 0, 0]) scale([0.9, 0.6, 1]) rotate_extrude($fn = 10) translate([0.45, 0]) circle(0.15, $fn = 6);
