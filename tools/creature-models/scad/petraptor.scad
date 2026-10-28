// Petraptor: Shalewing grown into a standing slate-grey pterosaur. A long swept-back crest set with an amber gem,
// a tan beak, tan belly plates and back studs, and big feathered slate wings with tan wrist bones.
include <lib.scad>

slate = [0.38, 0.4, 0.48];
slateHi = [0.52, 0.54, 0.62];
slateDark = [0.36, 0.38, 0.46];
tan = [0.8, 0.66, 0.46];
tanDark = [0.62, 0.48, 0.32];
amber = [0.95, 0.55, 0.08, NOGLOW];
amberHi = [1, 0.78, 0.35];

// Torso, leaning slightly forward.
blob([[[6.5, 5.5, 7], [0, 1, 14]], [[5, 4.6, 5], [0, -0.5, 20]]], slate);
// Tan belly plates.
for (i = [0 : 3]) color(i % 2 == 0 ? tan : tanDark) translate([0, -4.2 + i * 0.15, 21 - i * 2.6]) scale([3.6 - i * 0.3, 1.6, 1.5]) sphere(1, $fn = 18);
// Neck.
limb([0, -0.5, 21], [0, -2, 27], 3.4, 3, slate);

translate([0, -2, 28]) scale(1.55) translate([0, 2, -28]) {
// Head: a wedge skull, tan beak forward, crest swept far back and up.
blob([[[3.6, 4, 3.4], [0, -2.5, 29]], [[2.4, 2.6, 2.2], [0, -6, 28.4]]], slate);
color(tan) hull() {
  translate([0, -6.4, 28.6]) scale([2.2, 1.6, 2]) sphere(1, $fn = 14);
  translate([0, -13, 26.2]) sphere(0.4, $fn = 8);
}
color(tanDark) hull() {
  translate([0, -6.4, 27]) scale([1.8, 1.4, 1]) sphere(1, $fn = 12);
  translate([0, -11, 25.6]) sphere(0.35, $fn = 8);
}
// Crest: slate blade with a tan rim and an amber gem in the middle.
color(slate) hull() {
  translate([0, -2, 31]) scale([1.8, 3.6, 2.4]) sphere(1, $fn = 14);
  translate([0, 1, 34]) scale([1.5, 3, 3]) sphere(1, $fn = 14);
  translate([0, 7, 41]) sphere(0.8, $fn = 8);
}
color(tan) hull() {
  translate([0, -3.4, 31.6]) scale([1.2, 1.2, 1.2]) sphere(1, $fn = 10);
  translate([0, 6.6, 41.2]) sphere(0.4, $fn = 8);
}
mirror_x() {
  color(amber) translate([1.2, 1.8, 35]) rotate([-48, 0, 0]) scale([0.8, 1.8, 3.2]) sphere(1, $fn = 14);
  color(amberHi) translate([1.5, 1.2, 35.6]) rotate([-48, 0, 0]) scale([0.5, 0.8, 1.4]) sphere(1, $fn = 10);
}
// Fierce amber eyes under a tan brow.
mirror_x() {
  eye([2.8, -5, 29.8], 1.2, iris = amber, pupil = [0.15, 0.06, 0.02], yaw = -40, flat = 0.4);
  color(tan) translate([2.8, -5.3, 31]) rotate([0, -22, -30]) scale([1.8, 0.7, 0.5]) sphere(1, $fn = 12);
}

}

// Tan studs down the back of the neck and spine to the tail.
spinePts = [[0, 1, 29], [0, 1.4, 26.5], [0, 2.4, 24], [0, 4.6, 21], [0, 6, 18], [0, 6.8, 15], [0, 6.6, 12], [0, 6, 9], [0, 8, 6], [0, 11, 3.5]];
for (i = [0 : len(spinePts) - 1]) color(tan) translate(spinePts[i]) scale([1.4, 1.2, 1]) sphere(1.3 - i * 0.05, $fn = 12);

// Tail sweeping back to the ground.
chain([[0, 4, 11], [0, 8, 6], [0, 13, 3], [1, 17, 1.6]], [3, 2.2, 1.4, 0.4], slate);

// Legs: thick thighs, tan claws.
mirror_x() {
  ell([2.8, 3.4, 4], [3.6, 0, 9], slate);
  limb([3.8, 0, 7], [4.4, -0.6, 2], 1.8, 1.4, slate);
  ell([2, 3, 1.2], [4.4, -2, 1.2], slate);
  for (a = [-30, 0, 30]) spike([4.4 + sin(a) * 1.3, -4.4, 0.9], [sin(a) * 0.6, -1.4, -0.5], 0.5, 0.05, tan);
}

// Wings: arm to a tan-capped wrist with claws, long feathers hanging down and out.
module wing() {
  sh = [4.5, 0.5, 21]; el = [9, 1, 19]; wr = [13, 0, 26];
  limb(sh, el, 2.2, 1.8, slate);
  limb(el, wr, 1.8, 1.4, slate);
  // Tan wrist bone along the leading edge.
  chain([[8.6, 0.2, 20], wr, [18, 1, 25]], [1.0, 1.2, 0.6], tan);
  for (a = [-30, 10]) spike(wr + [-0.5, -0.6, 0], [sin(a) * 1.5 - 1, -1.6, -1.2], 0.5, 0.05, tan);
  // Wing panel, then overlapping feather blades on it, longest at the tip.
  color(slate) hull() {
    translate(sh) sphere(0.6, $fn = 8);
    translate(wr) sphere(0.6, $fn = 8);
    translate([18, 1, 25]) sphere(0.6, $fn = 8);
    translate([22, 2, 11]) sphere(0.6, $fn = 8);
    translate([12, 2, 6]) sphere(0.6, $fn = 8);
    translate([6, 2, 10]) sphere(0.6, $fn = 8);
  }
  feathers = [[[8, 2, 17], [7.5, 2.6, 8.5]], [[11, 2, 19], [11.5, 2.8, 6]], [[14, 2, 21], [16, 3, 6.5]],
              [[16.4, 1.8, 22.4], [19.5, 2.8, 8]], [[18.6, 1.6, 23.6], [22.4, 2.6, 11]]];
  for (i = [0 : len(feathers) - 1]) color(i % 2 == 0 ? slateDark : slateHi) hull() {
    translate(feathers[i][0] - [0, 0.6, 0]) scale([2.2, 1.1, 1]) sphere(1, $fn = 10);
    translate(feathers[i][1] - [0, 0.6, 0]) scale([1.2, 1, 1.4]) sphere(1, $fn = 8);
  }
}
mirror_x() wing();
