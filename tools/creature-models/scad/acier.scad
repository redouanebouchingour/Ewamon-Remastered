// Acier: a four-armed steel brawler, grey muscle-plated torso and arms, a black knight's helm with a gold crest and
// gold visor trim, gold-armoured legs over black boots with white claws, swords in three hands (two raised overhead,
// a broad cleaver held low) and a huge greatsword slung across its back.
include <lib.scad>

steel = [0.47, 0.47, 0.56];
steelDk = [0.33, 0.33, 0.4];
black = [0.12, 0.12, 0.14];
gold = [0.9, 0.72, 0.18];
goldDk = [0.6, 0.45, 0.1];
claw = [0.93, 0.93, 0.95];
blade = [0.94, 0.95, 0.98];
bladeDk = [0.25, 0.25, 0.28];
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
    color(bladeDk) translate([0, 0, gripL * 0.5 + l * 0.45]) cube([w * 0.3, 0.6, l * 0.75], center = true);
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
color(gold) hull() {
  translate([0, -3, 33]) sphere(0.6, $fn = 10);
  translate([0, 1, 37.5]) sphere(0.4, $fn = 10);
  translate([0, 2.5, 33]) sphere(0.6, $fn = 10);
}
mirror_x() color(gold) translate([1.4, -3.5, 30.2]) rotate([0, 25, 0]) scale([0.5, 0.6, 2.6]) sphere(1, $fn = 10);
color(gold) translate([0, -3.6, 28]) scale([1.6, 0.6, 0.6]) sphere(1, $fn = 10);
mirror_x() color([0.95, 0.85, 0.4]) translate([0.9, -3.6, 31.2]) scale([0.7, 0.3, 0.35]) sphere(1, $fn = 10);
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
